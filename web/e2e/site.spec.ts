import { expect, test } from '@playwright/test'

test('loads with project intro and problem visuals', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Porter', exact: true })).toBeVisible()
  await expect(page.locator('.intro-detail')).toContainText('reverse proxy')
  await expect(page.getByTestId('bottleneck-viz')).toBeVisible()
  await expect(page.getByTestId('stampede-viz')).toBeVisible()
  const problem = page.locator('#the-problem')
  await expect(problem.getByRole('img', { name: /Campus portal window, stage 0/ })).toBeVisible()
  await expect(problem.getByRole('img', { name: 'computer', exact: true })).toBeVisible()
  await expect(problem.getByLabel('tax forms', { exact: true })).toBeVisible()
  await expect(page.getByTestId('cache-leak-viz')).toBeVisible()
  await expect(page.getByTestId('collapse-viz')).toBeVisible()
  await expect(page.getByTestId('path-line-viz')).toBeVisible()
  await expect(page.getByTestId('overflow-viz')).toBeVisible()
})

test('Replay remounts the portal window', async ({ page }) => {
  await page.goto('/')
  const win = page.locator('#the-problem').getByRole('img', { name: /Campus portal window, stage 0/ })
  await expect(win).toBeVisible()
  await page.locator('#the-problem .story-window').getByRole('button', { name: 'Replay' }).click()
  await expect(win).toBeVisible()
  await expect(page.getByTestId('bottleneck-viz')).toBeVisible()
})

test('reduced motion still shows charts and last frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('#the-problem').getByRole('img', { name: /Campus portal window, stage 0/ })).toBeVisible()
  await expect(page.getByTestId('path-line-viz').getByTestId('live-line-grades')).toBeVisible()
  await page.locator('#run-crowd').getByRole('button', { name: 'Run crowd' }).click()
  await expect(page.locator('#run-crowd').getByTestId('count-rings')).toBeVisible()
})

test('run crowd shows live lines, funnel stages, and rings', async ({ page }) => {
  await page.goto('/')
  const crowd = page.locator('#run-crowd')
  await crowd.getByRole('button', { name: 'Run crowd' }).click()
  await expect(crowd.getByTestId('live-line-grades')).toBeVisible()
  await expect(crowd.getByTestId('live-line-tax')).toBeVisible()
  const funnel = crowd.getByTestId('crowd-funnel')
  await expect(funnel.getByText('crowd', { exact: true })).toBeVisible()
  await expect(crowd.getByTestId('count-rings')).toBeVisible()
  await expect(crowd.getByTestId('slot-gauge')).toBeVisible()
})
