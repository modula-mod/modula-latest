import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import type {PostId} from '@/api/contracts'
import {asArray, asIsoDate, asNumber, asRecord, asString} from '@/api/decoding/validation'
import {queryKeys} from '@/data/query'
import type {SocialComment} from '@/domain/social'
import {useAppServices} from '@/runtime'

function decodeComment(value: unknown): SocialComment {
  const record = asRecord(value, 'comment')
  return {
    id: asString(record.comment_id, 'comment id'),
    postId: asString(record.post_id, 'comment post id') as PostId,
    authorId: asString(record.author_actor_id, 'comment author id'),
    parentCommentId: typeof record.parent_comment_id === 'string' ? record.parent_comment_id : null,
    rootCommentId: typeof record.root_comment_id === 'string' ? record.root_comment_id : null,
    text: asString(record.text, 'comment text'),
    depth: asNumber(record.depth, 'comment depth'),
    replyCount: asNumber(record.reply_count, 'comment reply count'),
    version: asNumber(record.version, 'comment version'),
    createdAt: asIsoDate(record.created_at, 'comment created at'),
    updatedAt: asIsoDate(record.updated_at, 'comment updated at'),
    deletedAt: typeof record.deleted_at === 'string' ? record.deleted_at : null,
  }
}

function decodeComments(value: unknown): SocialComment[] {
  const record = asRecord(value, 'comment response')
  return asArray(record.items, 'comments', decodeComment)
}

export function useCommentsQuery(postId: PostId | null) {
  const {apiClient} = useAppServices()
  return useQuery({
    queryKey: postId ? queryKeys.comments.post(postId) : queryKeys.comments.all,
    enabled: Boolean(postId),
    queryFn: () =>
      apiClient.get(
        {path: `/v1/posts/${encodeURIComponent(postId!)}/comments`, authenticated: true},
        decodeComments,
      ),
  })
}

export function useCommentRepliesQuery(commentId: string, enabled: boolean) {
  const {apiClient} = useAppServices()
  return useQuery({
    queryKey: queryKeys.comments.replies(commentId),
    enabled,
    queryFn: () =>
      apiClient.get(
        {path: `/v1/comments/${encodeURIComponent(commentId)}/replies`, authenticated: true},
        decodeComments,
      ),
  })
}

export function useCommentMutations(postId: PostId) {
  const {apiClient} = useAppServices()
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({queryKey: queryKeys.comments.post(postId)})

  const create = useMutation({
    mutationFn: (text: string) =>
      apiClient.post(
        {path: `/v1/posts/${encodeURIComponent(postId)}/comments`, body: {text}, authenticated: true},
        decodeComment,
      ),
    onSuccess: refresh,
  })
  const reply = useMutation({
    mutationFn: ({commentId, text}: {commentId: string; text: string}) =>
      apiClient.post(
        {path: `/v1/comments/${encodeURIComponent(commentId)}/replies`, body: {text}, authenticated: true},
        decodeComment,
      ),
    onSuccess: (_data, variables) => {
      refresh()
      queryClient.invalidateQueries({queryKey: queryKeys.comments.replies(variables.commentId)})
    },
  })
  const edit = useMutation({
    mutationFn: ({commentId, text, expectedVersion}: {commentId: string; text: string; expectedVersion: number}) =>
      apiClient.patch(
        {path: `/v1/comments/${encodeURIComponent(commentId)}`, body: {text, expectedVersion}, authenticated: true},
        decodeComment,
      ),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (commentId: string) =>
      apiClient.delete(
        {path: `/v1/comments/${encodeURIComponent(commentId)}`, authenticated: true},
        () => undefined,
      ),
    onSuccess: refresh,
  })

  return {create, reply, edit, remove}
}
