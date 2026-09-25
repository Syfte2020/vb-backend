export enum TransactionStatus {
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum TransactionType {
  AUTHORIZATION = 'authorization',
  RECURRING_CHARGE = 'recurring_charge',
  REFUND = 'refund',
}
