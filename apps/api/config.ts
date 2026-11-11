export function configuration() {
  const pgUrl = process.env.DATABASE_URL;
  const mongoUrl = process.env.MONGO_URL;
  if (!pgUrl || !mongoUrl)
    throw new Error(
      "DATABASE_URL et MONGO_URL sont nécessaires. Voir README.md.",
    );
  const speed = process.env.DEMO_MODE === "true" ? 3600 : 1;
  return { pgUrl, mongoUrl, speed };
}
