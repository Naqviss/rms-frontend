'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircleIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LockIcon, UserIcon, UtensilsCrossedIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { LanguageToggle } from '@/components/shell/topbar-widgets'
import { useT } from '@/lib/i18n/use-t'
import { useAuthHydrated, useAuthStore } from '@/stores/auth-store'

/** Only allow in-app paths so `?next=` cannot bounce the user to another site. */
function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : '/dashboard'
}

function LoginForm() {
  const { t } = useT()
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  const hydrated = useAuthHydrated()
  const signedIn = useAuthStore((s) => !!s.username)
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (hydrated && signedIn) router.replace(next)
  }, [hydrated, signedIn, next, router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(false)
    // Small pause so the button state is visible, like a real network round trip.
    await new Promise((r) => setTimeout(r, 350))
    if (login(username, password)) {
      toast.success(t('auth.signedIn'))
      router.replace(next)
    } else {
      setError(true)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{t('auth.invalid')}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Field data-invalid={error || undefined}>
          <FieldLabel htmlFor="username">{t('auth.username')}</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <UserIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="username"
              name="username"
              autoComplete="username"
              autoFocus
              required
              value={username}
              aria-invalid={error || undefined}
              onChange={(e) => setUsername(e.target.value)}
            />
          </InputGroup>
        </Field>
        <Field data-invalid={error || undefined}>
          <FieldLabel htmlFor="password">{t('auth.password')}</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <LockIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              aria-invalid={error || undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={submitting || !username || !password}>
        {submitting && <Spinner data-icon="inline-start" />}
        {t('auth.signIn')}
      </Button>
      <button
        type="button"
        onClick={() => {
          setUsername('admin')
          setPassword('admin')
          setError(false)
        }}
        className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/40 p-3 text-start text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRoundIcon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">{t('auth.demo')}</span>
          <span className="block text-xs text-muted-foreground">
            {t('auth.username')}: <code className="font-mono text-foreground">admin</code> · {t('auth.password')}:{' '}
            <code className="font-mono text-foreground">admin</code>
          </span>
        </span>
      </button>
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
