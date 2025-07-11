import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Initialize public Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Cache for authenticated client to avoid multiple GoTrueClient instances
let authClient: ReturnType<typeof createClient<Database>> | null = null;

export const getAuthenticatedClient = async () => {
  if (authClient) {
    // Verify session is still valid
    const { data: { session }, error } = await authClient.auth.getSession();
    if (error || !session) {
      console.error('Session error:', JSON.stringify(error, null, 2));
      authClient = null; // Clear invalid client
    } else {
      console.log('Reusing authenticated client, user ID:', session.user.id);
      return authClient;
    }
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    console.error('Session error:', JSON.stringify(error, null, 2));
    throw new Error('No authenticated session found');
  }

  console.log('Creating new authenticated client, user ID:', session.user.id);
  authClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  });

  return authClient;
};

// Database types
export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          title: string;
          owner_id: string;
          status: 'draft' | 'sent' | 'signed' | 'completed';
          content: string | null;
          file_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          owner_id: string;
          status?: 'draft' | 'sent' | 'signed' | 'completed';
          content?: string | null;
          file_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          owner_id?: string;
          status?: 'draft' | 'sent' | 'signed' | 'completed';
          content?: string | null;
          file_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      recipients: {
        Row: {
          id: string;
          document_id: string;
          email: string;
          name: string;
          role: string;
          status: 'pending' | 'viewed' | 'signed';
          signing_url_token: string;
          token_expiry: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          email: string;
          name: string;
          role?: string;
          status?: 'pending' | 'viewed' | 'signed';
          signing_url_token?: string;
          token_expiry?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          email?: string;
          name?: string;
          role?: string;
          status?: 'pending' | 'viewed' | 'signed';
          signing_url_token?: string;
          token_expiry?: string;
          created_at?: string;
        };
      };
      signatures: {
        Row: {
          id: string;
          document_id: string;
          recipient_id: string;
          signed_at: string;
          ip_address: string | null;
          signature_data: string | null;
          user_agent: string | null;
          location: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          recipient_id: string;
          signed_at?: string;
          ip_address?: string | null;
          signature_data?: string | null;
          user_agent?: string | null;
          location?: string | null;
        };
        Update: {
          id?: string;
          document_id?: string;
          recipient_id?: string;
          signed_at?: string;
          ip_address?: string | null;
          signature_data?: string | null;
          user_agent?: string | null;
          location?: string | null;
        };
      };
      signature_fields: {
        Row: {
          id: string;
          document_id: string;
          field_type: 'signature' | 'text' | 'date';
          x_position: number;
          y_position: number;
          width: number;
          height: number;
          page_number: number;
          label: string;
          required: boolean;
          assigned_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          field_type: 'signature' | 'text' | 'date';
          x_position: number;
          y_position: number;
          width: number;
          height: number;
          page_number?: number;
          label: string;
          required?: boolean;
          assigned_to?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          field_type?: 'signature' | 'text' | 'date';
          x_position?: number;
          y_position?: number;
          width?: number;
          height?: number;
          page_number?: number;
          label?: string;
          required?: boolean;
          assigned_to?: string | null;
          created_at?: string;
        };
      };
      access_logs: {
        Row: {
          id: string;
          document_id: string;
          recipient_id: string | null;
          action: string;
          timestamp: string;
          ip_address: string | null;
          user_agent: string | null;
          location: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          recipient_id?: string | null;
          action: string;
          timestamp?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          location?: string | null;
        };
        Update: {
          id?: string;
          document_id?: string;
          recipient_id?: string | null;
          action?: string;
          timestamp?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          location?: string | null;
        };
      };
    };
  };
}