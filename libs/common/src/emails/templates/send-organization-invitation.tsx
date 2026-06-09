import { render, Html, Head, Body, Container, Section, Text, Button, Hr, Preview, Heading } from 'react-email';
import * as React from 'react';

export type SendOrganizationInvitationProps = {
  email: string;
  invitedByUsername: string;
  invitedByEmail: string;
  teamName: string;
  inviteLink: string;
};

export function SendOrganizationInvitation({
  email,
  invitedByUsername,
  invitedByEmail,
  teamName,
  inviteLink,
}: SendOrganizationInvitationProps) {
  return (
    <Html>
      <Head />
      <Preview>{invitedByUsername} invited you to join {teamName} on Redflag</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Heading style={logoText}>Redflag</Heading>
          </Section>

          <Section style={content}>
            <Heading style={heading}>You&apos;ve been invited!</Heading>

            <Text style={paragraph}>
              <strong>{invitedByUsername}</strong> ({invitedByEmail}) has invited you to join{' '}
              <strong>{teamName}</strong> on Redflag.
            </Text>

            <Text style={paragraph}>
              Click the button below to accept the invitation and get started.
            </Text>

            <Section style={buttonContainer}>
              <Button href={inviteLink} style={button}>
                Accept Invitation
              </Button>
            </Section>

            <Text style={hint}>
              Or copy and paste this link into your browser:{' '}
              <a href={inviteLink} style={link}>
                {inviteLink}
              </a>
            </Text>

            <Hr style={hr} />

            <Text style={footer}>
              This invitation was sent to <strong>{email}</strong>. If you were not expecting this
              invitation, you can ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderSendOrganizationInvitation(props: SendOrganizationInvitationProps) {
  const emailHtml = await render(<SendOrganizationInvitation {...props} />);
  return emailHtml;
}

const body: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 20px',
};

const logoSection: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '32px',
};

const logoText: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#1a1a2e',
  margin: '0',
};

const content: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '40px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: '600',
  color: '#1a1a2e',
  margin: '0 0 24px',
};

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#4a5568',
  margin: '0 0 16px',
};

const buttonContainer: React.CSSProperties = {
  textAlign: 'center',
  margin: '32px 0',
};

const button: React.CSSProperties = {
  backgroundColor: '#e53e3e',
  color: '#ffffff',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 32px',
  textDecoration: 'none',
  display: 'inline-block',
};

const hint: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '20px',
  color: '#718096',
  margin: '0 0 24px',
  wordBreak: 'break-all',
};

const link: React.CSSProperties = {
  color: '#e53e3e',
  textDecoration: 'underline',
};

const hr: React.CSSProperties = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
};

const footer: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '20px',
  color: '#a0aec0',
  margin: '0',
};
