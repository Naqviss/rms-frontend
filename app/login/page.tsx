'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircleIcon, EyeIcon, EyeOffIcon, LockIcon, UserIcon, UtensilsCrossedIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { LanguageToggle } from '@/components/shell/topbar-widgets'
import { useT } from '@/lib/i18n/use-t'
import { homeScreen, useAccount, useAuthHydrated, useAuthStore } from '@/stores/auth-store'
import { hasSession, supabaseConfigured } from '@/services/api/auth'
import { useSession } from '@/services/api/session'

/** Only allow in-app paths so `?next=` cannot bounce the user to another site. */
function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : null
}

function LoginForm() {
  const { t } = useT()
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  const hydrated = useAuthHydrated()
  const { account } = useAccount()
  const sessionReady = useSession((s) => s.status !== 'idle' && s.status !== 'loading')
  const signedInAs = account && hasSession() && sessionReady ? account : null
  const login = useAuthStore((s) => s.login)
  const loginWithToken = useAuthStore((s) => s.loginWithToken)
  const [tokenMode, setTokenMode] = useState(!supabaseConfigured())
  const [email, setEmail] = useState('')
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Without an explicit `?next=`, every account lands on its own screen.
  useEffect(() => {
    if (hydrated && signedInAs) router.replace(next ?? signedInAs.home)
  }, [hydrated, signedInAs, next, router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorText(null)
    try {
      if (tokenMode) await loginWithToken(secret)
      else await login(email, secret)
      toast.success(t('auth.signedIn'))
      // The guard on the destination explains workspace problems (no membership, etc.).
      router.replace(next ?? homeScreen())
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  const invalid = errorText ? true : undefined

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {errorText && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{errorText}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        {!tokenMode && (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <UserIcon aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                aria-invalid={invalid}
                onChange={(e) => setEmail(e.target.value)}
              />
            </InputGroup>
          </Field>
        )}
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="secret">{tokenMode ? 'Access token (JWT)' : t('auth.password')}</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <LockIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="secret"
              name={tokenMode ? 'token' : 'password'}
              type={showSecret ? 'text' : 'password'}
              autoComplete={tokenMode ? 'off' : 'current-password'}
              autoFocus={tokenMode}
              required
              value={secret}
              aria-invalid={invalid}
              onChange={(e) => setSecret(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => setShowSecret((v) => !v)}
                aria-label={showSecret ? t('auth.hidePassword') : t('auth.showPassword')}
                aria-pressed={showSecret}
              >
                {showSecret ? <EyeOffIcon /> : <EyeIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={submitting || (!tokenMode && !email) || !secret}>
        {submitting && <Spinner data-icon="inline-start" />}
        {t('auth.signIn')}
      </Button>
      {supabaseConfigured() ? (
        <button
          type="button"
          className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setTokenMode((v) => !v)
            setSecret('')
            setErrorText(null)
          }}
        >
          {tokenMode ? 'Sign in with email and password instead' : 'Developer: sign in with an access token'}
        </button>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Email sign-in needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
        </p>
      )}
    </form>
  )
}

export default function LoginPage() {
  const { t } = useT()
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar lg:block">
        <Image src="/food/hero.png" alt="" fill priority className="object-cover opacity-60" sizes="55vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/70 to-sidebar/20" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-10 text-sidebar-foreground">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <UtensilsCrossedIcon className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-semibold">{t('app.name')}</span>
          </div>
          <div className="max-w-md">
            <p className="text-3xl leading-tight font-semibold text-balance">{t('app.tagline')}</p>
            <p className="mt-3 text-sm text-pretty text-sidebar-foreground/70">{t('auth.pitch')}</p>
          </div>
        </div>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 lg:invisible">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UtensilsCrossedIcon className="size-4" aria-hidden />
            </span>
            <span className="font-semibold">{t('app.name')}</span>
          </span>
          <LanguageToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{t('auth.welcome')}</h1>
          <p className="mt-1 mb-8 text-sm text-muted-foreground">{t('auth.welcomeHint')}</p>
          <Suspense fallback={<Spinner className="mx-auto size-6 text-muted-foreground" />}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
