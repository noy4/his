import { useModel } from '@/lib/useModel'
import { AppModel } from '@/app/app'
import { SettingsModel, parsePatterns } from './settings.model'
import { ViewRoot } from '@/components/view/ViewRoot'
import { buttonPrimary } from '@/components/ui/button'
import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'

export function Settings({ app }: { app: AppModel }) {
  const model = useModel(() => new SettingsModel(app.api))
  const text = model.text.value
  const saving = model.saving.value
  const status = model.status.value
  const hiddenUrlCount = model.hiddenUrlCount.value
  const patternCount = parsePatterns(text).length

  return (
    <ViewRoot>
      <SettingsContainer>
        <SettingsSectionRoot>
          <SettingsSectionHeading>Privacy</SettingsSectionHeading>
          <SettingsSectionBody>
            <SettingsRowRoot layout="stack">
              <SettingsRowText>
                <SettingsRowTitle>Hide URL patterns</SettingsRowTitle>
                <SettingsRowDescription>
                  Hides matching pages. One pattern per line. A bare domain like <Code>example.com</Code> also
                  matches its subdomains.
                </SettingsRowDescription>
              </SettingsRowText>
              <SettingsTextArea value={text} onChange={model.setText} />
              <SettingsActionsRoot>
                <SettingsMeta>
                  {hiddenUrlCount !== null ? `${hiddenUrlCount} hidden · ` : ''}
                  {patternCount} pattern{patternCount === 1 ? '' : 's'}
                  {status ? ` · ${status}` : ''}
                </SettingsMeta>
                <SettingsPrimaryButton disabled={saving} onClick={() => model.save()}>
                  Save
                </SettingsPrimaryButton>
              </SettingsActionsRoot>
            </SettingsRowRoot>
          </SettingsSectionBody>
        </SettingsSectionRoot>
      </SettingsContainer>
    </ViewRoot>
  )
}

// --- layout ---

function SettingsContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl space-y-6">{children}</div>
}

function SettingsSectionRoot({ children }: { children: ReactNode }) {
  return <section className="space-y-2">{children}</section>
}

function SettingsSectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold text-text">{children}</h2>
}

function SettingsSectionBody({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border-2 overflow-hidden rounded-lg border bg-bg-2">
      {children}
    </div>
  )
}

function SettingsRowRoot({ layout = 'inline', children }: { layout?: 'inline' | 'stack'; children: ReactNode }) {
  return (
    <div className={cn('gap-4 px-4 py-3.5', layout === 'inline' ? 'flex items-center justify-between' : 'flex flex-col')}>
      {children}
    </div>
  )
}

function SettingsRowText({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>
}

function SettingsRowTitle({ children }: { children: ReactNode }) {
  return <div className="text-sm font-medium text-text">{children}</div>
}

function SettingsRowDescription({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-muted">{children}</p>
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-bg-3 px-1 font-mono text-text-2">{children}</code>
}

// --- controls ---

function SettingsTextArea({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <textarea
      aria-label="Hide URL patterns"
      value={value}
      spellCheck={false}
      rows={8}
      placeholder={'example.com\n*.bank.com\ngithub.com/*/pull/*'}
      onChange={(event) => onChange(event.currentTarget.value)}
      className="w-full resize-y rounded-sm border-0 bg-bg-3 px-3 py-2 font-mono text-sm text-text-2 outline-0 ring-1 ring-border-2 placeholder:text-muted focus:ring-primary"
    />
  )
}

function SettingsActionsRoot({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
}

function SettingsPrimaryButton({ className, children, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(buttonPrimary, className)}
    >
      {children}
    </button>
  )
}

function SettingsMeta({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-muted">{children}</span>
}
