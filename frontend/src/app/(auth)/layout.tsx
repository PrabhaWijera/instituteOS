export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-100 via-white to-indigo-100 dark:from-violet-950/30 dark:via-background dark:to-indigo-950/30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-violet-400/20 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-t from-indigo-400/10 to-transparent rounded-full blur-3xl" />

      <div className="relative w-full max-w-md animate-in">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-xl font-bold mb-4 shadow-xl shadow-violet-500/25">
            iO
          </div>
          <h1 className="text-3xl font-bold tracking-tight">instituteOS</h1>
          <p className="text-sm text-muted-foreground mt-1">Smart Institute Management Platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
