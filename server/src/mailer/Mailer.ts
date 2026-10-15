import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

// Implementación de desarrollo: no manda emails reales, solo escribe el
// mensaje en los logs. Sustituible por un proveedor real sin tocar a quien
// la usa (invitations.service.ts solo conoce la interfaz Mailer).
//
// El cuerpo lleva el enlace de invitación (un token), así que en producción
// solo se registra destinatario y asunto: el enlace lo ve el admin en la
// interfaz al crear la invitación.
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    const { to, subject, body } = message;
    if (env.NODE_ENV === 'production') {
      logger.info({ mail: { to, subject } }, 'Email (ConsoleMailer, cuerpo omitido)');
      return;
    }
    logger.info({ mail: { to, subject } }, `Email (ConsoleMailer)\n\n${body}\n`);
  }
}

export const mailer: Mailer = new ConsoleMailer();
