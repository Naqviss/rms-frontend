'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircleIcon,
  ChefHatIcon,
  ConciergeBellIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  UserIcon,
  UtensilsCrossedIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { LanguageToggle } from '@/components/shell/topbar-widgets'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { accountFor, demoAccounts, useAuthHydrated, useAuthStore } from '@/stores/auth-store'
import type { TranslationKey } from '@/lib/i18n/dictionary'

/** Only allow in-app paths so `?next=` cannot bounce the user to another site. */
function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : null
}

const accountMeta: Record<string, { label: TranslationKey; icon: typeof UserIcon }> = {
  admin: { label: 'auth.account.owner', icon: ShieldCheckIcon },
  kitchen: { label: 'auth.account.kitchen', icon: ChefHatIcon },
  waiter: { label: 'auth.account.waiter', icon: ConciergeBellIcon },
  counter: { label: 'auth.account.counter', icon: ReceiptIcon },
}

function LoginForm() {
  const { t } = useT()
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  const hydrated = useAuthHydrated()
  const signedInAs = useAuthStore((s) => accountFor(s.username))
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Without an explicit `?next=`, every account lands on its own screen.
  useEffect(() => {
    if (hydrated && signedInAs) router.replace(next ?? signedInAs.home)
  }, [hydrated, signedInAs, next, router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(false)
    // Small pause so the button state is visible, like a real network round trip.
    await new Promise((r) => setTimeout(r, 350))
    const account = login(username, password)
    if (account) {
      toast.success(t('auth.signedIn'))
      router.replace(next ?? account.home)
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
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t('auth.demoAccounts')}</p>
        <div className="grid grid-cols-2 gap-2">
          {demoAccounts.map((a) => {
            const meta = accountMeta[a.username]
            const Icon = meta.icon
            const selected = username === a.username
            return (
              <button
                key={a.username}
                type="button"
                onClick={() => {
                  setUsername(a.username)
                  setPassword(a.password)
                  setError(false)
                }}
                aria-pressed={selected}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border border-dashed bg-muted/40 p-2.5 text-start text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  selected && 'border-solid border-primary bg-primary/5',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{t(meta.label)}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {a.username} / {a.password}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
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
