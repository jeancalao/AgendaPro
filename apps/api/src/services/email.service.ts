// Serviço de e-mail usando Resend.com
import { Resend } from 'resend';
import { createHash } from 'crypto';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Inicialização lazy: evita crash na startup se a chave não estiver configurada
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada');
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL  = process.env.EMAIL_FROM  || 'AgendaPRO <noreply@agendapro.com.br>';
const APP_URL     = process.env.APP_URL     || 'http://localhost:5173';
const CANCEL_SECRET = process.env.EMAIL_CANCEL_SECRET || 'secret-change-in-production';

// ─── Utilitários ──────────────────────────────────────────────────────────────

export function generateCancelToken(appointmentId: string, clientEmail: string): string {
  return createHash('sha256')
    .update(`${appointmentId}${clientEmail}${CANCEL_SECRET}`)
    .digest('hex');
}

export function buildCancelUrl(appointmentId: string, clientEmail: string): string {
  const token = generateCancelToken(appointmentId, clientEmail);
  return `${APP_URL}/cancel/${appointmentId}/${token}`;
}

function formatDate(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
}

function formatPrice(price: any): string {
  const num = typeof price === 'object' ? Number(price) : Number(price);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Função base ──────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const { error } = await getResend().emails.send({ from: FROM_EMAIL, to, subject, html });
    if (error) {
      console.error('[EMAIL ERROR]', error);
    }
  } catch (err) {
    // E-mail nunca deve quebrar o fluxo principal
    console.error('[EMAIL EXCEPTION]', err);
  }
}

// ─── Templates HTML ───────────────────────────────────────────────────────────

function wrapTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgendaPRO</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Cabeçalho -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">AgendaPRO</h1>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Agendamento online simplificado</p>
            </td>
          </tr>
          <!-- Conteúdo -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>
          <!-- Rodapé -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                AgendaPRO &mdash; Agendamento online para profissionais autônomos<br/>
                Este e-mail foi enviado automaticamente, por favor não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── E-mails específicos ───────────────────────────────────────────────────────

export interface AppointmentEmailParams {
  appointmentId:   string;
  clientName:      string;
  clientEmail:     string;
  professionalName: string;
  serviceName:     string;
  servicePrice:    any;
  startDateTime:   Date;
  endDateTime:     Date;
}

// 1. Confirmação de agendamento (enviado ao cliente)
export async function sendAppointmentConfirmation(params: AppointmentEmailParams): Promise<void> {
  const cancelUrl = buildCancelUrl(params.appointmentId, params.clientEmail);
  const confirmationCode = params.appointmentId.slice(-8).toUpperCase();

  const content = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Agendamento confirmado! ✅</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Olá, <strong>${params.clientName}</strong>! Seu agendamento foi confirmado com sucesso.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:0;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;width:140px;">Profissional</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${params.professionalName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;">Serviço</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${params.serviceName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;">Data e hora</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${formatDate(params.startDateTime)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;">Valor</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${formatPrice(params.servicePrice)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;">Código</td>
            <td style="padding:6px 0;color:#3b82f6;font-size:14px;font-weight:700;letter-spacing:1px;">${confirmationCode}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;color:#64748b;font-size:14px;">
      Precisa cancelar? Clique no botão abaixo com até 2 horas de antecedência.
    </p>
    <a href="${cancelUrl}"
       style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
      Cancelar agendamento
    </a>
  `;

  await sendEmail(
    params.clientEmail,
    `Agendamento confirmado — ${params.serviceName} com ${params.professionalName}`,
    wrapTemplate(content),
  );
}

// 2. Lembrete (24h antes — enviado ao cliente)
export async function sendAppointmentReminder(params: AppointmentEmailParams): Promise<void> {
  const cancelUrl = buildCancelUrl(params.appointmentId, params.clientEmail);

  const content = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Lembrete de agendamento 🔔</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Olá, <strong>${params.clientName}</strong>! Seu agendamento é <strong>amanhã</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;width:140px;">Profissional</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${params.professionalName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;">Serviço</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${params.serviceName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;">Data e hora</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${formatDate(params.startDateTime)}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Não poderá comparecer? Cancele com antecedência.</p>
    <a href="${cancelUrl}"
       style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
      Cancelar agendamento
    </a>
  `;

  await sendEmail(
    params.clientEmail,
    `Lembrete: ${params.serviceName} amanhã com ${params.professionalName}`,
    wrapTemplate(content),
  );
}

// 3. Cancelamento (enviado ao cliente)
export async function sendAppointmentCancelled(params: AppointmentEmailParams & { cancelReason?: string }): Promise<void> {
  const rebookUrl = `${APP_URL}/agendar`; // link genérico para reagendar

  const content = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Agendamento cancelado</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Olá, <strong>${params.clientName}</strong>. Seu agendamento foi cancelado.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;width:140px;">Profissional</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${params.professionalName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;">Serviço</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${params.serviceName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;">Data e hora</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;">${formatDate(params.startDateTime)}</td>
          </tr>
          ${params.cancelReason ? `
          <tr>
            <td style="padding:6px 0;color:#475569;font-size:14px;">Motivo</td>
            <td style="padding:6px 0;color:#1e293b;font-size:14px;">${params.cancelReason}</td>
          </tr>` : ''}
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Quer remarcar? Acesse o link abaixo.</p>
    <a href="${rebookUrl}"
       style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
      Agendar novamente
    </a>
  `;

  await sendEmail(
    params.clientEmail,
    `Agendamento cancelado — ${params.serviceName} com ${params.professionalName}`,
    wrapTemplate(content),
  );
}

// 4. Boas-vindas ao profissional (enviado após registro)
export async function sendWelcomeProfessional(params: {
  professionalName: string;
  professionalEmail: string;
  slug: string;
}): Promise<void> {
  const dashboardUrl = `${APP_URL}/dashboard`;
  const publicUrl    = `${APP_URL}/agendar/${params.slug}`;

  const content = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Bem-vindo ao AgendaPRO! 🎉</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Olá, <strong>${params.professionalName}</strong>! Sua conta foi criada com sucesso.
      Agora você pode começar a receber agendamentos online.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;color:#15803d;font-size:14px;font-weight:600;">Próximos passos:</p>
        <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
          <li>Configure seus <strong>serviços</strong> (nome, duração e preço)</li>
          <li>Defina sua <strong>disponibilidade</strong> semanal</li>
          <li>Compartilhe seu <strong>link de agendamento</strong> com seus clientes</li>
        </ol>
      </td></tr>
    </table>

    <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Seu link público de agendamento:</p>
    <p style="margin:0 0 24px;">
      <a href="${publicUrl}" style="color:#3b82f6;font-size:14px;word-break:break-all;">${publicUrl}</a>
    </p>

    <a href="${dashboardUrl}"
       style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
      Acessar painel
    </a>
  `;

  await sendEmail(
    params.professionalEmail,
    'Bem-vindo ao AgendaPRO! Sua conta está pronta.',
    wrapTemplate(content),
  );
}
