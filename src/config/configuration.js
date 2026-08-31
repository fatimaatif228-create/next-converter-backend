export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  supabaseUrl: process.env.SUPABASE_URL,
  supabasePublishablekey: process.env.SUPABASE_PUBLISHABLE_KEY,
  supabaseSecretkey: process.env.SUPABASE_SECRET_KEY,
  redisUrl: process.env.REDIS_URL,
});
