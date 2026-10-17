import amqp from 'amqplib'
import { RABBITMQ_URL } from './config.js'
export const QUEUE ='task_queue'
export const RETRY_QUEUE = 'task_queue.retry'
export const DLQ = 'task_queue.dlq'

let channel: amqp.ConfirmChannel | undefined

async function connectWithRetry(url: string, retries = 20, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await amqp.connect(url)
    } catch (err) {
      console.log(`RabbitMQ not ready (attempt ${i}/${retries}), retrying in ${delayMs / 1000}s...`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw new Error('Could not connect to RabbitMQ')
}

export async function connectRabbit(){
  const connection = await connectWithRetry(RABBITMQ_URL ?? 'amqp://localhost')
  channel = await connection.createConfirmChannel();

  await channel.assertQueue(
      QUEUE,
      {
          durable: true,
          arguments: { 'x-queue-type': 'classic'}
      }
  )

  await channel.assertQueue(RETRY_QUEUE, {durable: true, arguments: {
      'x-queue-type': 'classic',
      'x-message-ttl': 5000,                  
      'x-dead-letter-exchange': '',           
      'x-dead-letter-routing-key': QUEUE,     
      "x-max-priority": 5,
  },
  })

  await channel.assertQueue(DLQ, { durable: true, arguments: { 'x-queue-type': 'classic' } })
  console.log('RabbitMq Connected')
}

export function getChannel(){
    if(!channel) throw new Error('RabbitMQ not connected yet')
    return channel
}


export async function publishJob( jobId: string, priority: number) {
  const ch = getChannel();

  ch.sendToQueue(
    QUEUE,
    Buffer.from(JSON.stringify({ jobId })),
    {
      persistent: true,
      priority: 6 - priority,
    },
  );

  await ch.waitForConfirms();
}

