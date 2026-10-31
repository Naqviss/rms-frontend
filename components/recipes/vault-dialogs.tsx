'use client'

import { useEffect, useState } from 'react'
import { EyeOffIcon, FingerprintIcon, HistoryIcon, LockKeyholeIcon, ShieldCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { OptionSelect } from '@/components/common/option-select'
import { useT } from '@/lib/i18n/use-t'
import { useRecipeVault } from '@/stores/recipe-vault-store'

const validPin = (pin: string) => /^\d{4,6}$/.test(pin)

function PinInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <Input
      id={id}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      autoFocus={autoFocus}
      className="h-11 text-center text-lg tracking-[0.5em]"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
    />
  )
}

/** New PIN plus confirmation; calls `onSubmit` only with a matching 4–6 digit PIN. */
function NewPinForm({ submitLabel, onSubmit, children }: { submitLabel: string; onSubmit: (pin: string) => Promise<void>; children?: React.ReactNode }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const error = !validPin(pin) ? 'Use 4 to 6 digits.' : pin !== confirm ? 'The two PINs do not match.' : null

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setTouched(true)
        if (error) return
        setBusy(true)
        try {
          await onSubmit(pin)
        } finally {
          setBusy(false)
        }
      }}
    >
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="vault-pin">New PIN</FieldLabel>
          <PinInput id="vault-pin" value={pin} onChange={setPin} autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="vault-pin-confirm">Type it again</FieldLabel>
          <PinInput id="vault-pin-confirm" value={confirm} onChange={setConfirm} />
        </Field>
      </FieldGroup>
      {touched && error && <FieldError>{error}</FieldError>}
      <DialogFooter>
        {children}
        <Button type="submit" disabled={busy}>
          {busy && <Spinner data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** First visit: explain how recipes are protected, then have the owner pick a vault PIN. */
export function VaultWelcome({ open, onDone }: { open: boolean; onDone: () => void }) {
  const { t } = useT()
  const setWelcomed = useRecipeVault((s) => s.setWelcomed)
  const setPin = useRecipeVault((s) => s.setPin)
  const [step, setStep] = useState<'promise' | 'pin'>('promise')

  const finish = () => {
    setWelcomed()
    onDone()
  }

  const points = [
    { icon: LockKeyholeIcon, title: t('recipes.welcome.pin'), body: t('recipes.welcome.pinHint') },
    { icon: EyeOffIcon, title: t('recipes.welcome.secret'), body: t('recipes.welcome.secretHint') },
    { icon: HistoryIcon, title: t('recipes.welcome.log'), body: t('recipes.welcome.logHint') },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={step === 'pin'}>
        {step === 'promise' ? (
          <>
            <div className="flex flex-col items-center gap-3 pt-2 text-center">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <ShieldCheckIcon className="size-8" aria-hidden />
              </span>
              <DialogHeader className="items-center">
                <DialogTitle className="text-xl">{t('recipes.welcome.title')}</DialogTitle>
                <DialogDescription className="max-w-sm text-balance">{t('recipes.welcome.body')}</DialogDescription>
              </DialogHeader>
            </div>
            <ul className="flex flex-col gap-3">
              {points.map((p) => (
                <li key={p.title} className="flex gap-3 rounded-lg border p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <p.icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button className="w-full sm:w-auto" onClick={() => setStep('pin')}>
                <FingerprintIcon data-icon="inline-start" />
                {t('recipes.welcome.cta')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Choose your vault PIN</DialogTitle>
              <DialogDescription>4 to 6 digits. You will need it to open full recipes and secret ingredients. Do not share it with staff.</DialogDescription>
            </DialogHeader>
            <NewPinForm
              submitLabel="Lock my recipes"
              onSubmit={async (pin) => {
                await setPin(pin)
                toast.success('Recipe vault is ready. Your recipes are locked with your PIN.')
                finish()
              }}
            >
              <Button type="button" variant="ghost" onClick={finish}>
                Skip for now
              </Button>
            </NewPinForm>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface UnlockProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResult: (ok: boolean) => void
}

export function VaultUnlockDialog({ open, onOpenChange, onResult }: UnlockProps) {
  const unlock = useRecipeVault((s) => s.unlock)
  const lockoutUntil = useRecipeVault((s) => s.lockoutUntil)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const lockedOut = !!lockoutUntil && lockoutUntil > now

  useEffect(() => {
    if (open) {
      setPin('')
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !lockedOut) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [open, lockedOut])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyholeIcon className="size-4" aria-hidden />
            Unlock recipe vault
          </DialogTitle>
          <DialogDescription>Enter your vault PIN to see full recipes and secret ingredients.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!validPin(pin) || lockedOut) return
            setBusy(true)
            const result = await unlock(pin)
            setBusy(false)
            setNow(Date.now())
            onResult(result.ok)
            if (result.ok) {
              onOpenChange(false)
              return
            }
            setPin('')
            setError(result.lockedUntil ? 'Too many wrong PINs. The vault is blocked for a minute.' : `Wrong PIN. ${result.attemptsLeft} tries left before a one-minute block.`)
          }}
        >
          <Field>
            <FieldLabel htmlFor="unlock-pin" className="sr-only">
              Vault PIN
            </FieldLabel>
            <PinInput id="unlock-pin" value={pin} onChange={setPin} autoFocus />
            {lockedOut ? (
              <FieldError>Blocked after too many wrong PINs. Try again in {Math.ceil((lockoutUntil - now) / 1000)} s.</FieldError>
            ) : (
              error && <FieldError>{error}</FieldError>
            )}
          </Field>
          <Button type="submit" disabled={busy || lockedOut || !validPin(pin)}>
            {busy && <Spinner data-icon="inline-start" />}
            Unlock
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function VaultSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const hasPin = useRecipeVault((s) => !!s.pinHash)
  const autoLockMinutes = useRecipeVault((s) => s.autoLockMinutes)
  const setAutoLockMinutes = useRecipeVault((s) => s.setAutoLockMinutes)
  const unlock = useRecipeVault((s) => s.unlock)
  const setPin = useRecipeVault((s) => s.setPin)
  const [current, setCurrent] = useState('')
  const [currentError, setCurrentError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setCurrent('')
      setCurrentError(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vault settings</DialogTitle>
          <DialogDescription>How your recipes are locked on this device.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="auto-lock">Lock automatically after</FieldLabel>
          <OptionSelect
            id="auto-lock"
            value={String(autoLockMinutes)}
            onValueChange={(v) => setAutoLockMinutes(Number(v))}
            options={[1, 5, 15, 30].map((m) => ({ value: String(m), label: `${m} minute${m > 1 ? 's' : ''} without activity` }))}
          />
          <FieldDescription>The vault also locks when you sign out or reload the page.</FieldDescription>
        </Field>
        <Separator />
        <div className="flex flex-col gap-3">
          <p className="font-medium">{hasPin ? 'Change PIN' : 'Set a PIN'}</p>
          {hasPin && (
            <Field>
              <FieldLabel htmlFor="current-pin">Current PIN</FieldLabel>
              <PinInput id="current-pin" value={current} onChange={setCurrent} />
              {currentError && <FieldError>{currentError}</FieldError>}
            </Field>
          )}
          <NewPinForm
            submitLabel={hasPin ? 'Change PIN' : 'Set PIN'}
            onSubmit={async (pin) => {
              if (hasPin) {
                const result = await unlock(current)
                if (!result.ok) {
                  setCurrentError(result.lockedUntil ? 'Too many wrong PINs. Try again in a minute.' : 'Current PIN is wrong.')
                  return
                }
              }
              await setPin(pin)
              toast.success(hasPin ? 'Vault PIN changed' : 'Vault PIN set. Your recipes are now locked.')
              onOpenChange(false)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
