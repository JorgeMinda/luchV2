import { createClient } from '@supabase/supabase-js'

const url = 'https://selnoqwywcipdbcgzieg.supabase.co'
const key = 'sb_publishable_mz0ewdol5oLhEKJ-OxNwsg_STSLF9-a'

const supabase = createClient(url, key)

async function checkAuth() {
  // Check if there are any users in auth
  // We need to use service role for this, but let's try to sign up a test admin
  console.log('=== Verificando auth.users ===')
  
  // Try to sign in with a known admin email
  // First, let's see if we can sign up
  const testEmail = `admin${Date.now()}@example.com`
  const testPassword = 'Admin123!'
  
  // Try sign in first
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  })
  
  if (signInError) {
    console.log('Sign in failed:', signInError.message)
    
    // Try sign up
    console.log('Intentando sign up...')
    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: 'Admin User',
          role: 'admin'
        }
      }
    })
    
    if (signUpError) {
      console.log('Sign up failed:', signUpError.message)
    } else {
      console.log('Sign up successful:', signUp.user?.id)
      console.log('Session:', signUp.session?.access_token ? 'yes' : 'no')
      
      if (signUp.session) {
        // Check profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', signUp.user?.id)
          .single()
        console.log('Profile:', profile)
      }
    }
  } else {
    console.log('Sign in successful:', signIn.user?.id)
    console.log('Session: yes')
    
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', signIn.user?.id)
      .single()
    console.log('Profile:', profile)
  }
}

checkAuth()