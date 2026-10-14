export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

// Implementación de desarrollo: no manda emails reales, solo escribe el
// enlace en los logs. Sustituible por un proveedor real sin tocar a quien
// la usa (invitations.service.ts solo conoce la interfaz Mailer).
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.log(
      `\n--- Email a ${message.to} ---\nAsunto: ${message.subject}\n\n${message.body}\n---\n`,
    );
  }
}

export const mailer: Mailer = new ConsoleMailer();
