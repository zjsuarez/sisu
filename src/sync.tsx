import { motion } from 'motion/react'
import { Check, CloudOff, CloudUpload, LoaderCircle, Monitor, Smartphone, TriangleAlert, X } from 'lucide-react'
import { deviceId, removeDevice, useStore, type Device } from './store'
import { fmtAgo, fmtDay, fmtTime, Tap } from './ui'

export const deviceLabel = (id: string, devices: Device[]) =>
  id === 'schedule-import' ? 'Schedule (imported)' : (devices.find((d) => d.id === id)?.name ?? 'another device')

/** This device's own sync state: the part no other device can see. */
export function SyncBadge() {
  const { sync, devices } = useStore()
  const synced = devices.find((d) => d.id === deviceId)?.lastSyncedAt
  const where = sync.online ? 'Connecting' : 'Offline'

  const s = sync.error
    ? { icon: TriangleAlert, text: "Couldn't sync", tone: 'text-red-400' }
    : sync.waiting && !sync.inSync
      ? { icon: CloudOff, text: `${where} · ${sync.waiting} waiting to upload`, tone: 'text-amber-300' }
      : sync.waiting
        ? { icon: CloudUpload, text: `Uploading ${sync.waiting}…`, tone: 'text-volt' }
        : !sync.inSync
          ? { icon: sync.online ? LoaderCircle : CloudOff, text: synced ? `${where} · synced ${fmtAgo(synced)}` : `${where} · saved on device`, tone: 'text-zinc-400' }
          : { icon: Check, text: 'Synced', tone: 'text-emerald-400' }

  return (
    <motion.span
      key={s.text}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      title={sync.error ?? undefined}
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium ${s.tone}`}
    >
      <s.icon size={13} className={s.icon === LoaderCircle ? 'animate-spin' : ''} />
      {s.text}
    </motion.span>
  )
}

/** Every device on the account, with when it was last fully uploaded and its last workout. */
export function Devices() {
  const { devices, sessions } = useStore()
  const list = [...devices].sort((a, b) => Number(b.id === deviceId) - Number(a.id === deviceId) || (b.lastSyncedAt ?? 0) - (a.lastSyncedAt ?? 0))

  if (!list.length) return <p className="card p-5 text-sm text-zinc-500">No devices yet. This one appears after its first sync.</p>

  return (
    <div className="card divide-y divide-line">
      {list.map((d) => {
        const Icon = d.type === 'desktop' ? Monitor : Smartphone
        const last = sessions.find((s) => s.deviceId === d.id)
        return (
          <div key={d.id} className="flex gap-4 px-5 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-volt">
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-semibold">
                {d.name}
                {d.id === deviceId && <span className="ml-2 text-xs font-medium text-zinc-500">this device</span>}
              </p>
              <p className="text-xs text-zinc-400">
                {d.id === deviceId ? <SyncBadge /> : d.lastSyncedAt ? `Up to date as of ${fmtAgo(d.lastSyncedAt)}` : 'Never finished a sync'}
              </p>
              <p className="text-xs text-zinc-500">
                {last ? `Last workout: ${last.title} · ${fmtDay(last.at)} ${last.start}` : 'No workouts logged here'}
                {last && !last.syncedAt && ' · waiting to upload'}
                {last?.syncedAt && d.id !== deviceId && ` · in the cloud ${fmtTime(last.syncedAt)}`}
              </p>
            </div>
            {/* reinstalls and cleared browsers leave dead entries behind; workouts they logged are untouched */}
            {d.id !== deviceId && (
              <Tap
                onClick={() => confirm(`Remove ${d.name} from the list? Its workouts stay.`) && removeDevice(d.id)}
                aria-label={`Remove ${d.name}`}
                className="grid size-8 shrink-0 place-items-center self-center rounded-full bg-surface-2 text-zinc-500"
              >
                <X size={14} />
              </Tap>
            )}
          </div>
        )
      })}
    </div>
  )
}
