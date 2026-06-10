import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { renderSendOrganizationInvitation, SendOrganizationInvitationProps } from './templates/send-organization-invitation';

const apiKey = process.env.MAILGUN_API_KEY!;
const mailgunDomain = process.env.MAILGUN_DOMAIN ?? '';
const mailgunFrom = process.env.MAILGUN_FROM ?? 'chat@mg.inovetix.com';
const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3002';

const mailgun = new Mailgun(FormData);
const mailgunClient = mailgun.client({ username: 'api', key: apiKey });

export function sendEmail(to: string[], subject: string, html: string) {
  return mailgunClient.messages.create(mailgunDomain, {
    from: `Redflag <${mailgunFrom}>`,
    to,
    subject,
    html,
  });
}

export async function sendOrganizationInvitation(props: SendOrganizationInvitationProps) {
  const emailHtml = await renderSendOrganizationInvitation(props);
  const res = await sendEmail([props.email], `You've been invited to join ${props.teamName} on Redflag`, emailHtml);
  console.log(res);
  return res;
}