import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined');
}

// Database type definitions
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
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          owner_id: string;
          status?: 'draft' | 'sent' | 'signed' | 'completed';
          content?: string | null;
          file_url?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          owner_id?: string;
          status?: 'draft' | 'sent' | 'signed' | 'completed';
          content?: string | null;
          file_url?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      recipients: {
        Row: {
          id: string;
          document_id: string;
          email: string;
          name: string;
          role?: string;
          status: 'pending' | 'viewed' | 'signed';
          signing_url_token: string | null;
          token_expiry: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          email: string;
          name: string;
          role?: string;
          status?: 'pending' | 'viewed' | 'signed';
          signing_url_token?: string | null;
          token_expiry?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          email?: string;
          name?: string;
          role?: string;
          status?: 'pending' | 'viewed' | 'signed';
          signing_url_token?: string | null;
          token_expiry?: string | null;
          created_at?: string;
        };
      };
      signatures: {
        Row: {
          id: string;
          document_id: string;
          field_id: string | null;
          recipient_id: string | null;
          signed_at: string;
          ip_address: string | null;
          signature_data: string | null;
          user_agent: string | null;
          location: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          field_id?: string | null;
          recipient_id?: string | null;
          signed_at?: string;
          ip_address?: string | null;
          signature_data?: string | null;
          user_agent?: string | null;
          location?: string | null;
        };
        Update: {
          id?: string;
          document_id?: string;
          field_id?: string | null;
          recipient_id?: string | null;
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
          page_number: number;
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

// Initialize public Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Cache for authenticated client
let authClient: ReturnType<typeof createClient<Database>> | null = null;

export const getAuthenticatedClient = async () => {
  if (authClient) {
    console.log('Reusing cached authenticated client');
    return authClient;
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Error fetching session:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to fetch session: ${error.message}`);
    }

    if (!session) {
      console.error('No active session found');
      throw new Error('No authenticated session found');
    }

    console.log('Creating new authenticated client, user ID:', session.user.id);
    authClient = supabase; // Use the same client instance since it's already authenticated
    return authClient;
  } catch (error: any) {
    console.error('getAuthenticatedClient failed:', JSON.stringify(error, null, 2));
    throw new Error(`Authentication error: ${error.message}`);
  }
};