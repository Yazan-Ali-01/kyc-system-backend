export const normalizeIpAddress =(ip: string): string => {
  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.substring(7);
  return ip;
}

