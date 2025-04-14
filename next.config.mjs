/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  api: {
    bodyParser: {
      sizeLimit: '50gb',
    },
    responseLimit: '50gb',
  },
};

export default nextConfig; 