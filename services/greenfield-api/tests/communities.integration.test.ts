import {randomUUID} from 'node:crypto'

import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('GreenField persistent Communities', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let runSuffix = ''

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4034'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4034'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_MEDIA_ROOT = `/tmp/modula-communities-${process.pid}`
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').execute()
    await app.ready()
    runSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('supports discover, join, post, vote, RSVP, settings and leave with real persistence', async () => {
    const owner = await createVerifiedUser(`cown${runSuffix}`.slice(0, 20), 'Community Owner')
    const member = await createVerifiedUser(`cmem${runSuffix}`.slice(0, 20), 'Community Member')
    const second = await createVerifiedUser(`csec${runSuffix}`.slice(0, 20), 'Second Member')
    const publicCoverId = await createReadyImage(owner.accessToken, `public-${runSuffix}.png`)

    const created = await authed(owner.accessToken, 'POST', '/v1/communities', {
      slug: `modula-builders-${runSuffix}`,
      name: 'Modula Builders',
      description: 'A persistent QA community for people building Modula.',
      category: 'Technology',
      visibility: 'public',
      membershipPolicy: 'open',
      postingPolicy: 'members',
      coverAttachmentId: publicCoverId,
    })
    expect(created.statusCode, created.body).toBe(201)
    const community = created.json().data.community
    expect(community).toMatchObject({
      name: 'Modula Builders', visibility: 'public', discoverable: true,
      memberCount: 1, membership: 'active', viewerRole: 'owner', version: 1,
    })
    const communityId = community.id as string
    const publicCover = await app.inject({method: 'GET', url: `/v1/attachments/${publicCoverId}/content`})
    expect(publicCover.statusCode).toBe(200)

    const discovery = await app.inject({method: 'GET', url: `/v1/communities?query=${encodeURIComponent(`modula-builders-${runSuffix}`)}&limit=1`})
    expect(discovery.statusCode).toBe(200)
    expect(discovery.json().data.items).toHaveLength(1)
    expect(discovery.json().data.items[0].id).toBe(communityId)
    expect(discovery.json().data.hasMore).toBe(false)

    const joins = await Promise.all(Array.from({length: 10}, () => authed(
      member.accessToken, 'POST', `/v1/communities/${communityId}/join`, {},
    )))
    expect(joins.every(response => response.statusCode === 200)).toBe(true)
    expect(new Set(joins.map(response => response.json().data.membership.status))).toEqual(new Set(['active']))
    expect(await db.selectFrom('greenfield_community_memberships').selectAll()
      .where('community_id', '=', communityId).where('actor_id', '=', member.actorId).execute()).toHaveLength(1)
    expect((await authed(second.accessToken, 'POST', `/v1/communities/${communityId}/join`, {})).statusCode).toBe(200)
    const memberSettings = await authed(member.accessToken, 'GET', `/v1/communities/${communityId}/settings`)
    expect(memberSettings.statusCode).toBe(200)
    expect(memberSettings.json().data.settings).toMatchObject({
      canManage: false, membershipPolicy: 'open', postingPolicy: 'members', inviteLinksEnabled: false,
      blockedWords: null,
      notificationPreferences: {notifyMentions: true, weeklyDigest: false, eventReminders: true},
    })
    const memberPreferences = await authed(member.accessToken, 'PATCH', `/v1/communities/${communityId}/settings`, {
      notifyMentions: false, weeklyDigest: true, eventReminders: false,
    })
    expect(memberPreferences.statusCode, memberPreferences.body).toBe(200)
    expect(memberPreferences.json().data.settings.version).toBe(memberSettings.json().data.settings.version)
    expect(memberPreferences.json().data.settings.notificationPreferences).toEqual({
      notifyMentions: false, weeklyDigest: true, eventReminders: false,
    })
    const membersPage1 = (await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}/members?limit=1`)).json().data
    expect(membersPage1).toMatchObject({hasMore: true})
    const membersPage2 = (await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}/members?limit=1&cursor=${encodeURIComponent(membersPage1.nextCursor)}`)).json().data
    expect(membersPage2.items[0].actorId).not.toBe(membersPage1.items[0].actorId)

    const concurrentPosts = await Promise.all(Array.from({length: 8}, () => authed(
      member.accessToken, 'POST', `/v1/communities/${communityId}/posts`, {
        text: 'A canonical community post.', idempotencyKey: `community-post-${runSuffix}`,
      },
    )))
    expect(concurrentPosts.every(response => response.statusCode === 201)).toBe(true)
    const post = concurrentPosts[0]!
    expect(post.statusCode, post.body).toBe(201)
    expect(post.json().data.item).toMatchObject({communityId, moderationState: 'visible'})
    expect(post.json().data.item.post).toMatchObject({text: 'A canonical community post.', audience: 'public'})
    const postId = post.json().data.item.post.id as string
    expect(await db.selectFrom('posts').selectAll().where('id', '=', postId).executeTakeFirst()).toMatchObject({
      community_id: communityId, community_moderation_state: 'visible',
    })
    const replay = await authed(member.accessToken, 'POST', `/v1/communities/${communityId}/posts`, {
      text: 'A canonical community post.', idempotencyKey: `community-post-${runSuffix}`,
    })
    expect(replay.statusCode).toBe(201)
    expect(replay.json().data.item.post.id).toBe(postId)
    expect(await db.selectFrom('posts').selectAll().where('community_id', '=', communityId).execute()).toHaveLength(1)
    const mismatchedReplay = await authed(member.accessToken, 'POST', `/v1/communities/${communityId}/posts`, {
      text: 'A changed payload.', idempotencyKey: `community-post-${runSuffix}`,
    })
    expect(mismatchedReplay.statusCode).toBe(409)
    const secondPost = await authed(owner.accessToken, 'POST', `/v1/communities/${communityId}/posts`, {
      text: 'A second canonical post for cursor verification.', idempotencyKey: `community-post-owner-${runSuffix}`,
    })
    expect(secondPost.statusCode).toBe(201)
    const postsPage1 = (await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}/posts?limit=1`)).json().data
    expect(postsPage1).toMatchObject({hasMore: true})
    const postsPage2 = (await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}/posts?limit=1&cursor=${encodeURIComponent(postsPage1.nextCursor)}`)).json().data
    expect(postsPage2.items[0].post.id).not.toBe(postsPage1.items[0].post.id)

    const comment = await authed(owner.accessToken, 'POST', `/v1/posts/${postId}/comments`, {text: 'Existing comments remain usable.'})
    expect(comment.statusCode, comment.body).toBe(201)
    const reaction = await authed(owner.accessToken, 'PUT', `/v1/posts/${postId}/reaction`, {type: 'support'})
    expect(reaction.statusCode, reaction.body).toBe(200)

    const pollCreated = await authed(owner.accessToken, 'POST', `/v1/communities/${communityId}/polls`, {
      question: 'Which area should we build next?', options: ['Profiles', 'Modules', 'Governance'],
      closesAt: new Date(Date.now() + 86_400_000).toISOString(), allowVoteChanges: true,
      resultsVisibility: 'afterVote',
    })
    expect(pollCreated.statusCode, pollCreated.body).toBe(201)
    const poll = pollCreated.json().data.poll
    expect(poll.totalVotes).toBeNull()
    const pollId = poll.id as string
    const optionId = poll.options[1].id as string
    const pollsPage = await authed(member.accessToken, 'GET', `/v1/communities/${communityId}/polls?limit=1`)
    expect(pollsPage.statusCode).toBe(200)
    expect(pollsPage.json().data.items[0].id).toBe(pollId)
    const votes = await Promise.all(Array.from({length: 8}, () => authed(
      member.accessToken, 'PUT', `/v1/communities/${communityId}/polls/${pollId}/vote`, {optionId},
    )))
    expect(votes.every(response => response.statusCode === 200)).toBe(true)
    expect(votes.at(-1)!.json().data.poll).toMatchObject({viewerOptionId: optionId, totalVotes: 1})
    expect(await db.selectFrom('greenfield_community_poll_votes').selectAll()
      .where('poll_id', '=', pollId).where('actor_id', '=', member.actorId).execute()).toHaveLength(1)
    const changedVote = await authed(member.accessToken, 'PUT', `/v1/communities/${communityId}/polls/${pollId}/vote`, {
      optionId: poll.options[2].id,
    })
    expect(changedVote.json().data.poll).toMatchObject({viewerOptionId: poll.options[2].id, totalVotes: 1})

    const invalidTimezone = await authed(owner.accessToken, 'POST', `/v1/communities/${communityId}/events`, {
      title: 'Invalid timezone', startsAt: new Date(Date.now() + 172_800_000).toISOString(),
      endsAt: new Date(Date.now() + 176_400_000).toISOString(),
      timezone: 'Mars/Olympus', location: {type: 'tba'},
    })
    expect(invalidTimezone.statusCode).toBe(400)
    const eventCreated = await authed(owner.accessToken, 'POST', `/v1/communities/${communityId}/events`, {
      title: 'Builders QA Gathering', description: 'An isolated QA event.',
      startsAt: new Date(Date.now() + 172_800_000).toISOString(),
      endsAt: new Date(Date.now() + 176_400_000).toISOString(),
      timezone: 'Europe/London', location: {type: 'online', onlineUrl: 'https://example.invalid/modula-builders'},
      capacity: 2,
    })
    expect(eventCreated.statusCode, eventCreated.body).toBe(201)
    const eventId = eventCreated.json().data.event.id as string
    const eventsPage = await authed(member.accessToken, 'GET', `/v1/communities/${communityId}/events?limit=1`)
    expect(eventsPage.statusCode).toBe(200)
    expect(eventsPage.json().data.items[0].id).toBe(eventId)
    const capacityRace = await Promise.all([
      authed(member.accessToken, 'PUT', `/v1/communities/${communityId}/events/${eventId}/response`, {response: 'going'}),
      authed(second.accessToken, 'PUT', `/v1/communities/${communityId}/events/${eventId}/response`, {response: 'going'}),
      authed(owner.accessToken, 'PUT', `/v1/communities/${communityId}/events/${eventId}/response`, {response: 'going'}),
    ])
    expect(capacityRace.map(response => response.statusCode).sort()).toEqual([200, 200, 409])
    const eventReload = await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}/events/${eventId}`)
    expect(eventReload.json().data.event.goingCount).toBe(2)
    const invalidCapacityReduction = await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}/events/${eventId}`, {
      expectedVersion: 1, capacity: 1,
    })
    expect(invalidCapacityReduction.statusCode).toBe(409)
    const cancelledEvent = await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}/events/${eventId}`, {
      expectedVersion: 1, status: 'cancelled',
    })
    expect(cancelledEvent.statusCode).toBe(200)
    expect(cancelledEvent.json().data.event.status).toBe('cancelled')
    expect((await authed(member.accessToken, 'PUT', `/v1/communities/${communityId}/events/${eventId}/response`, {
      response: 'interested',
    })).statusCode).toBe(409)

    const cancelledPoll = await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}/polls/${pollId}`, {
      expectedVersion: 1, status: 'cancelled',
    })
    expect(cancelledPoll.statusCode).toBe(200)
    expect((await authed(second.accessToken, 'PUT', `/v1/communities/${communityId}/polls/${pollId}/vote`, {
      optionId,
    })).statusCode).toBe(409)

    const settings = await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}/settings`)
    expect(settings.statusCode).toBe(200)
    const settingsVersion = settings.json().data.settings.version
    const changed = await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}/settings`, {
      expectedVersion: settingsVersion, postingPolicy: 'moderators', blockedWords: ['spoiler'],
      allowAttachments: false,
    })
    expect(changed.statusCode, changed.body).toBe(200)
    expect(changed.json().data.settings).toMatchObject({
      canManage: true, membershipPolicy: 'open', postingPolicy: 'moderators', inviteLinksEnabled: false,
      allowAttachments: false, blockedWords: ['spoiler'],
    })
    const policyRevision = await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}`)
    expect(policyRevision.json().data.community.version).toBe(2)
    const policyViaCommunity = await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}`, {
      expectedVersion: 2, membershipPolicy: 'approval',
    })
    expect(policyViaCommunity.statusCode).toBe(200)
    expect(policyViaCommunity.json().data.community).toMatchObject({membershipPolicy: 'approval', version: 3})
    const staleCrossContractPolicy = await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}/settings`, {
      expectedVersion: changed.json().data.settings.version, inviteLinksEnabled: true,
    })
    expect(staleCrossContractPolicy.statusCode).toBe(409)
    const synchronizedSettings = await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}/settings`)
    expect(synchronizedSettings.json().data.settings).toMatchObject({membershipPolicy: 'approval', version: 3})
    const deniedPost = await authed(member.accessToken, 'POST', `/v1/communities/${communityId}/posts`, {
      text: 'Members can no longer post.', idempotencyKey: `denied-${runSuffix}`,
    })
    expect(deniedPost.statusCode).toBe(403)
    expect((await authed(member.accessToken, 'POST', `/v1/communities/${communityId}/polls`, {
      question: 'Not authorized?', options: ['Yes', 'No'], closesAt: new Date(Date.now() + 86_400_000).toISOString(),
    })).statusCode).toBe(403)
    expect((await authed(member.accessToken, 'POST', `/v1/communities/${communityId}/events`, {
      title: 'Not authorized', startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 90_000_000).toISOString(), timezone: 'Europe/London', location: {type: 'tba'},
    })).statusCode).toBe(403)

    const leave = await authed(member.accessToken, 'POST', `/v1/communities/${communityId}/leave`, {})
    expect(leave.statusCode).toBe(200)
    expect(leave.json().data.left).toBe(true)
    const reloaded = await authed(member.accessToken, 'GET', `/v1/communities/${communityId}`)
    expect(reloaded.json().data.community.membership).toBe('none')
    const ownerLeave = await authed(owner.accessToken, 'POST', `/v1/communities/${communityId}/leave`, {})
    expect(ownerLeave.statusCode).toBe(409)
  })

  it('fails closed for private communities, banned members and stale writes while preserving social interoperability', async () => {
    const owner = await createVerifiedUser(`pown${runSuffix}`.slice(0, 20), 'Private Owner')
    const member = await createVerifiedUser(`pmem${runSuffix}`.slice(0, 20), 'Private Member')
    const outsider = await createVerifiedUser(`pout${runSuffix}`.slice(0, 20), 'Private Outsider')
    const privateCoverId = await createReadyImage(owner.accessToken, `private-${runSuffix}.png`)

    const created = await authed(owner.accessToken, 'POST', '/v1/communities', {
      slug: `private-modula-lab-${runSuffix}`,
      name: 'Private Modula Lab', category: 'Research', visibility: 'private', discoverable: true,
      membershipPolicy: 'approval', postingPolicy: 'members',
      coverAttachmentId: privateCoverId,
    })
    expect(created.statusCode).toBe(201)
    const community = created.json().data.community
    const communityId = community.id as string
    expect(community.discoverable).toBe(false)
    expect((await app.inject({method: 'GET', url: `/v1/attachments/${privateCoverId}/content`})).statusCode).toBe(403)
    expect((await authed(outsider.accessToken, 'GET', `/v1/attachments/${privateCoverId}/content`)).statusCode).toBe(403)
    expect((await app.inject({method: 'GET', url: `/v1/communities/${communityId}`})).statusCode).toBe(404)
    expect((await authed(outsider.accessToken, 'POST', `/v1/communities/${communityId}/join`, {})).statusCode).toBe(404)

    const now = new Date()
    await db.insertInto('greenfield_community_memberships').values({
      community_id: communityId, actor_id: member.actorId, role: 'member', status: 'active', joined_at: now,
      notify_mentions: true, weekly_digest: false, event_reminders: true,
      created_at: now, updated_at: now, version: 1,
    }).execute()
    const privateView = await authed(member.accessToken, 'GET', `/v1/communities/${communityId}`)
    expect(privateView.statusCode).toBe(200)
    expect((await authed(member.accessToken, 'GET', `/v1/attachments/${privateCoverId}/content`)).statusCode).toBe(200)

    const post = await authed(member.accessToken, 'POST', `/v1/communities/${communityId}/posts`, {
      text: 'Private canonical community post.', idempotencyKey: `private-post-${runSuffix}`,
    })
    expect(post.statusCode, post.body).toBe(201)
    const postId = post.json().data.item.post.id as string
    expect(post.json().data.item.post.audience).toBe('private')
    expect((await authed(outsider.accessToken, 'GET', `/v1/posts/${postId}`)).statusCode).toBe(404)
    expect((await authed(member.accessToken, 'GET', `/v1/posts/${postId}`)).statusCode).toBe(200)
    expect((await authed(member.accessToken, 'POST', `/v1/posts/${postId}/comments`, {text: 'Private member comment'})).statusCode).toBe(201)
    expect((await authed(member.accessToken, 'PUT', `/v1/posts/${postId}/reaction`, {type: 'insightful'})).statusCode).toBe(200)

    const settings = await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}/settings`)
    const version = settings.json().data.settings.version
    expect((await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}/settings`, {
      expectedVersion: version, reactionsEnabled: false, blockedWords: ['secret'],
    })).statusCode).toBe(200)
    const disabledReaction = await authed(member.accessToken, 'PUT', `/v1/posts/${postId}/reaction`, {type: 'fire'})
    expect(disabledReaction.statusCode).toBe(403)
    const blockedEdit = await authed(member.accessToken, 'PATCH', `/v1/posts/${postId}`, {
      text: 'This edit contains the secret term.', expectedVersion: 1,
    })
    expect(blockedEdit.statusCode).toBe(400)
    expect((await authed(member.accessToken, 'PATCH', `/v1/communities/${communityId}/settings`, {
      expectedVersion: version + 1, reactionsEnabled: true,
    })).statusCode).toBe(403)
    expect((await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}/settings`, {
      inviteLinksEnabled: true,
    })).statusCode).toBe(400)

    const current = await authed(owner.accessToken, 'GET', `/v1/communities/${communityId}`)
    const staleVersion = current.json().data.community.version
    const firstUpdate = await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}`, {
      expectedVersion: staleVersion, description: 'One accepted update.',
    })
    expect(firstUpdate.statusCode).toBe(200)
    const staleUpdate = await authed(owner.accessToken, 'PATCH', `/v1/communities/${communityId}`, {
      expectedVersion: staleVersion, description: 'A stale overwrite.',
    })
    expect(staleUpdate.statusCode).toBe(409)

    await db.updateTable('greenfield_community_memberships').set({role: 'restricted'})
      .where('community_id', '=', communityId).where('actor_id', '=', member.actorId).execute()
    const restricted = await authed(member.accessToken, 'POST', `/v1/communities/${communityId}/posts`, {
      text: 'Restricted members cannot post.', idempotencyKey: `restricted-${runSuffix}`,
    })
    expect(restricted.statusCode).toBe(403)
    await db.updateTable('greenfield_community_memberships').set({role: 'member', status: 'banned', joined_at: null})
      .where('community_id', '=', communityId).where('actor_id', '=', member.actorId).execute()
    expect((await authed(member.accessToken, 'GET', `/v1/communities/${communityId}`)).statusCode).toBe(404)
  })

  it('rejects unauthenticated mutations, unknown privileged fields and invalid ownership transitions', async () => {
    const owner = await createVerifiedUser(`sown${runSuffix}`.slice(0, 20), 'Security Owner')
    const noAuth = await app.inject({method: 'POST', url: '/v1/communities', payload: {name: 'No Auth', category: 'QA'}})
    expect(noAuth.statusCode).toBe(401)
    const forged = await authed(owner.accessToken, 'POST', '/v1/communities', {
      name: 'Forged Owner', category: 'QA', ownerActorId: randomUUID(), featured: true,
    })
    expect(forged.statusCode).toBe(400)
    const malformed = await authed(owner.accessToken, 'POST', '/v1/communities', {name: '', category: ''})
    expect(malformed.statusCode).toBe(400)
  })

  async function createVerifiedUser(handle: string, displayName: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    await db.deleteFrom('greenfield_auth_rate_limits').execute()
    const register = await app.inject({
      method: 'POST', url: '/v1/accounts/register',
      payload: {email, password, handle, displayName, acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode, register.body).toBe(201)
    const verified = await app.inject({
      method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken},
    })
    expect(verified.statusCode).toBe(200)
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect([200, 201]).toContain(session.statusCode)
    const accessToken = session.json().data.accessToken as string
    const me = await app.inject({method: 'GET', url: '/v1/accounts/me', headers: {authorization: `Bearer ${accessToken}`}})
    const accountId = me.json().data.accountId as string
    const profile = await db.selectFrom('actors').innerJoin('profiles', 'profiles.actor_id', 'actors.id')
      .select(['profiles.id as profile_id', 'actors.id as actor_id']).where('actors.account_id', '=', accountId).executeTakeFirstOrThrow()
    return {accountId, actorId: profile.actor_id, profileId: profile.profile_id, handle, accessToken}
  }

  async function createReadyImage(accessToken: string, filename: string): Promise<string> {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64')
    const created = await authed(accessToken, 'POST', '/v1/attachments/uploads', {
      filename, mimeType: 'image/png', size: png.length,
    })
    expect(created.statusCode, created.body).toBe(201)
    const session = created.json().data
    const uploaded = await app.inject({
      method: 'PUT', url: `/v1/attachments/uploads/${session.uploadId}/content`,
      headers: {authorization: `Bearer ${accessToken}`, 'content-type': 'application/octet-stream'},
      payload: png,
    })
    expect(uploaded.statusCode, uploaded.body).toBe(200)
    return session.attachmentId
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({
      method: method as any, url, headers: {authorization: `Bearer ${accessToken}`},
      ...(payload === undefined ? {} : {payload}),
    })
  }
})
