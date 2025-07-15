import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Use '*' for development; replace with 'https://signpearl.com' in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    // Parse request body
    const { recipients, subject, text, html } = await req.json();

    // Validate input
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipients provided' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
    if (!subject || !text || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Prepare SendGrid personalizations with substitutions
    const personalizations = recipients.map((recipient: { email: string; signingUrl: string }) => ({
      to: [{ email: recipient.email }],
      substitutions: {
        '%SIGNING_URL%': recipient.signingUrl,
      },
    }));

    // Make SendGrid API request
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('VITE_SENDGRID_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations,
        from: { email: 'support@signpearl.com' },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`SendGrid API error: ${errorData}`);
    }

    return new Response(
      JSON.stringify({ message: 'Emails sent successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send emails' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});