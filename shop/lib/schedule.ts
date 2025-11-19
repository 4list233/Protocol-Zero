import scheduleConfig from '../../shared/data/schedule_config.json'

export type DaySchedule = {
  dayIndex: number
  name: string
  hours: string
  basePrice: number
  discountedPrice?: number
  discountLabel?: string
  lateNightPrice?: number
  lateNightHours?: string
}

function to12Hour(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (h === 0) return `12:${m.toString().padStart(2, '0')}AM`
  if (h < 12) return `${h}:${m.toString().padStart(2, '0')}AM`
  if (h === 12) return `12:${m.toString().padStart(2, '0')}PM`
  return `${h - 12}:${m.toString().padStart(2, '0')}PM`
}

function formatHours(hours: { open: string; close: string }): string {
  return `${to12Hour(hours.open)}-${to12Hour(hours.close)}`
}

export function getWeekSchedule(): DaySchedule[] {
  const days = (scheduleConfig as any).weekSchedule as any[]
  return days.map((day) => {
    const pricing = day.pricing || {}
    let lnHours: string | undefined
    if (pricing.lateNight?.hours) {
      const parts = String(pricing.lateNight.hours).split('-')
      if (parts.length === 2) {
        lnHours = `${to12Hour(parts[0])}-${to12Hour(parts[1])}`
      } else {
        lnHours = pricing.lateNight.hours
      }
    }
    return {
      dayIndex: day.dayIndex,
      name: day.name,
      hours: formatHours(day.hours),
      basePrice: pricing.base,
      discountedPrice: pricing.discounted,
      discountLabel: pricing.discountType || pricing.special,
      lateNightPrice: pricing.lateNight?.price,
      lateNightHours: lnHours
    }
  })
}
