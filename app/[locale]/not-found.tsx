import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

export default function NotFound() {
    // This page is a catch-all for invalid routes within the localized path.
    // It shouldn't contain much logic as it's just a 404.
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-4xl font-bold">404 - Not Found</h1>
            <p className="mt-2 text-lg">The page you are looking for does not exist.</p>
        </div>
    );
}
