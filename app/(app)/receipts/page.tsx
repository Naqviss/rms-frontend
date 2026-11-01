'use client'

import { useState } from 'react'
import { PrinterIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { useOrders } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

export default function ReceiptsPage() {
  const { t } = useT()
  const { data } = useOrders()
  const { inBranch } = useScope()
  const [paper, setPaper] = useState('80')
  const [businessName, setBusinessName] = useState('Dastarkhwan Restaurant')
  const [address, setAddress] = useState('MM Alam Road, Gulberg III, Lahore')
  const [ntn, setNtn] = useState('NTN 1234567-8')
  const [footer, setFooter] = useState('Thank you for dining with us!')
  const [showTax, setShowTax] = useState(true)
  const [showQr, setShowQr] = useState(true)
  const [showCashier, setShowCashier] = useState(true)
  const [orderId, setOrderId] = useState('')

  const orders = inBranch(data ?? []).slice(0, 12)
  const order = orders.find((o) => o.id === orderId) ?? orders[0]

  return (
    <>
      <PageHeader
        title={t('receipts.title')}
        description={t('receipts.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <PrinterIcon data-icon="inline-start" />
              {t('common.print')}
            </Button>
            <Button onClick={() => toast.success(t('common.saved'))}>{t('common.saveChanges')}</Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('receipts.template')}</CardTitle>
            <CardDescription>{t('receipts.templateHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="paper">{t('receipts.paperWidth')}</FieldLabel>
                <ToggleGroup id="paper" variant="outline" value={[paper]} onValueChange={(v) => v.length && setPaper(v[0])} className="w-fit">
                  <ToggleGroupItem value="58">58 mm</ToggleGroupItem>
                  <ToggleGroupItem value="80">80 mm</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="bn">{t('receipts.businessName')}</FieldLabel>
                <Input id="bn" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="ad">{t('common.address')}</FieldLabel>
                <Input id="ad" value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="ntn">{t('receipts.taxNumber')}</FieldLabel>
                <Input id="ntn" value={ntn} onChange={(e) => setNtn(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="ft">{t('receipts.footer')}</FieldLabel>
                <Textarea id="ft" rows={2} value={footer} onChange={(e) => setFooter(e.target.value)} />
              </Field>
              <Separator />
              {[
                [t('receipts.showTax'), showTax, setShowTax],
                [t('receipts.showQr'), showQr, setShowQr],
                [t('receipts.showCashier'), showCashier, setShowCashier],
              ].map(([label, value, setter]) => (
                <label key={String(label)} className="flex items-center justify-between text-sm">
                  {String(label)}
                  <Switch checked={value as boolean} onCheckedChange={setter as (v: boolean) => void} />
                </label>
              ))}
            </FieldGroup>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-3">
          {orders.length > 0 && (
            <OptionSelect
              value={order?.id ?? ''}
              onValueChange={setOrderId}
              aria-label={t('receipts.sampleOrder')}
              options={orders.map((o) => ({ value: o.id, label: `${o.number} - ${o.customerName}` }))}
            />
          )}
          <div className="flex justify-center rounded-lg bg-muted p-4">
            <div className={cn('bg-white p-4 font-mono text-xs text-black shadow-sm', paper === '58' ? 'w-56' : 'w-72')} aria-label={t('receipts.preview')}>
              <p className="text-center text-sm font-bold">{businessName}</p>
              <p className="text-center">{address}</p>
              <p className="text-center">{ntn}</p>
              <hr className="my-2 border-dashed border-black/40" />
              {order && (
                <>
                  <p>{order.number}</p>
                  <p>{formatDateTime(order.createdAt)}</p>
                  {showCashier && <p>Cashier: Ayesha</p>}
                  <hr className="my-2 border-dashed border-black/40" />
                  {order.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {i.quantity} x {i.name}
                      </span>
                      <span>{formatCurrency(i.quantity * i.unitPrice)}</span>
                    </div>
                  ))}
                  <hr className="my-2 border-dashed border-black/40" />
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {showTax && (
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>{formatCurrency(order.tax)}</span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between text-sm font-bold">
                    <span>TOTAL</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </>
              )}
              <hr className="my-2 border-dashed border-black/40" />
              <p className="text-center">{footer}</p>
              {showQr && (
                <div className="mx-auto mt-2 grid size-16 grid-cols-6 gap-px" aria-hidden>
                  {Array.from({ length: 36 }, (_, i) => (
                    <span key={i} className={(i * 7 + (i % 5)) % 3 === 0 ? 'bg-black' : 'bg-black/10'} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
