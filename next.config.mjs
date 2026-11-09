const isProd = process.env.NODE_ENV === "production";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

if (isProd) {
  SECURITY_HEADERS.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfmake/pdfkit leem arquivos do próprio pacote: carregar de node_modules
  // em vez de empacotar.
  serverExternalPackages: ["pdfmake"],
  experimental: {
    // Upload de PDFs e imagens (máx. 4 MB por arquivo, ver src/lib/library.js)
    // + folga para o multipart. A Vercel corta qualquer corpo acima de 4,5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      // Arquivos do acervo: nada roda se forem abertos direto no navegador
      // (um SVG enviado poderia ter <script>). Sobrescreve o CSP acima.
      {
        source: "/arquivos/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
