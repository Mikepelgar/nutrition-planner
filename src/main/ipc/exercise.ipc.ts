import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import {
  addExercise, getExercisesForDate, deleteExercise, getCaloriesBurnedForDate, getExerciseRange
} from '../db/queries/exercise.queries'
import { asDate, asString, asNumber, asInt } from './validate'

export function registerExerciseIPC(): void {
  ipcMain.handle('exercise:add', (_e, p: { date: string; name: string; caloriesBurned: number; durationMin?: number }) =>
    addExercise(getDb(), {
      date: asDate(p?.date, 'date'),
      name: asString(p?.name, 'name', 120).trim() || 'Exercise',
      caloriesBurned: asNumber(p?.caloriesBurned, 'caloriesBurned', { min: 0, max: 30000 }),
      durationMin: p?.durationMin == null ? null : asNumber(p.durationMin, 'durationMin', { min: 0, max: 1440 })
    })
  )
  ipcMain.handle('exercise:getForDate', (_e, p: { date: string }) => getExercisesForDate(getDb(), asDate(p?.date, 'date')))
  ipcMain.handle('exercise:delete', (_e, p: { id: number }) => {
    deleteExercise(getDb(), asInt(p?.id, 'id'))
    return { success: true }
  })
  ipcMain.handle('exercise:caloriesForDate', (_e, p: { date: string }) => ({
    calories: getCaloriesBurnedForDate(getDb(), asDate(p?.date, 'date'))
  }))
  ipcMain.handle('exercise:getRange', (_e, p: { startDate: string; endDate: string }) =>
    getExerciseRange(getDb(), asDate(p?.startDate, 'startDate'), asDate(p?.endDate, 'endDate'))
  )
}
