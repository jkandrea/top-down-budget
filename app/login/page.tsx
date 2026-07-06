import Link from "next/link";
import { signInAction } from "@/actions/auth-actions";

type LoginPageProps = {
  searchParams: Promise<{ signup?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { signup, error } = await searchParams;

  return (
    <main className="min-h-[calc(100vh-64px)] bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-md">
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Welcome Back</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">로그인</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">기존 계정으로 빠르게 가계부를 이어서 관리하세요.</p>
          </div>

          <div className="space-y-4 p-6">
            {signup === "ok" ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                <span className="mr-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">OK</span>
                회원가입이 완료되었습니다. 이메일 인증 설정에 따라 인증 메일 확인 후 로그인해 주세요.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                <span className="mr-2 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">ERROR</span>
                {error}
              </div>
            ) : null}

            <form action={signInAction} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  이메일
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  비밀번호
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                로그인
              </button>
            </form>

            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                회원가입 하러가기
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                홈으로 돌아가기
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
