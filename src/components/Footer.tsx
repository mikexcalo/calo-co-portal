import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="py-12 px-6 text-center">
      <p className="text-[10.5px] tracking-[0.04em] text-[#b0b8c4]">
        Powered by{' '}
        <Link
          href="https://mikecalo.co"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#b0b8c4] hover:text-[#64748b] transition-colors"
        >
          CALO&CO
        </Link>
      </p>
    </footer>
  );
}
