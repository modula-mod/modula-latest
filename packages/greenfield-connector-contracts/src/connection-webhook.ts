export type GreenfieldConnectorWebhookSignatureAlgorithm =
  | 'hmac-sha256'
  | 'provider-managed'
  | 'none'

export type GreenfieldConnectorWebhookSupport = {
  supported: boolean
  signatureRequired: boolean
  signatureAlgorithm: GreenfieldConnectorWebhookSignatureAlgorithm
  eventTypes: string[]
}

export type GreenfieldConnectorWebhookDeliveryStatus =
  | 'received'
  | 'accepted'
  | 'rejected'
  | 'queued'
  | 'processed'
  | 'failed'

export type GreenfieldConnectorWebhookDelivery = {
  deliveryId: string
  providerId: string
  endpointId: string
  eventType: string
  status: GreenfieldConnectorWebhookDeliveryStatus
  receivedAt: string
  failureCode?: string
}
