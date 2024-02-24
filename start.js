function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time)
	})
}

async function getParentOptionId(page, optionText, selectFieldId, optionFieldId) {
	await page.waitForSelector(selectFieldId)
	await page.click(selectFieldId)
	await page.waitForSelector(optionFieldId)

	const parentId = await page.evaluate(
		(text, optionFieldId) => {
			const option = Array.from(document.querySelectorAll('span.mat-option-text')).find(
				option => option.textContent.trim() === text
			)
			return option ? option.closest(optionFieldId).id : null
		},
		optionText,
		optionFieldId
	)

	return parentId
}

async function selectTermAndGroup(page) {
	let optionId = await getParentOptionId(page, term, '#mat-select-6', 'mat-option')
	await page.click(`#${optionId}`)

	optionId = await getParentOptionId(page, location, 'input[id="mat-input-0"]', 'mat-option')
	await page.click(`#${optionId}`)

	optionId = await getParentOptionId(page, day, '#mat-select-0', 'mat-option')
	await page.click(`#${optionId}`)

	await page.click('.orangeButton')
}

async function login(page, browser) {
	await page.waitForSelector('input[formcontrolname="username"]')
	await page.type('input[formcontrolname="username"]', email)
	await page.type('input[formcontrolname="password"]', pass)
	await delay(500)
	const enteredValue = await page.$eval('input[formcontrolname="username"]', input => input.value)
	if (enteredValue !== email) {
		console.error(
			'Wykonywanie skryptu zablokowane przez wyskakujące okno. Zamknij je klikając przycisk [Cancel] lub spróbuj ponownie. Okno wyskakuje losowo czasami nawet pare razy pod rząd.'
		)
		if (browser) {
			await browser.close()
		}
		return false
	}

	await Promise.all([page.click('button[data-testid="login-button"]'), page.waitForNavigation()])
	await page.goto('https://giganciprogramowaniaformularz.edu.pl/app/ListaObecnosci')
	return true
}

function createObjectFromHeaderText(headerText) {
	// Jeżeli to czytasz to Ci współczuje, ale to była najszybsza i najprostsza droga
	const regex =
		/\[(.*?)\]\s*(\d{2}:\d{2})-(\d{2}:\d{2})\s*(\w+)\s*\|\s*(.*?)\s*Wiek\s*(.*?)\s*lat\s*(.*?)\s*Start zajęć\s*(\d{4}-\d{2}-\d{2})\s*Liczba spotkań:\s*(\d+)\s*Ilość uczniów:\s*(\d+)\s*Numer sali:\s*(\d+)/

	const match = headerText.match(regex)

	if (!match) {
		console.error('Nie udało się dopasować nagłówka zajęć. Prawdopodobnie weszła aktualizacja zmieniająca.')
		return null
	}

	const [, groupID, startTime, endTime, day, name, ageCategory, address, startDate, meetings, students, room] = match

	const obj = {
		groupID,
		startTime,
		endTime,
		day,
		name,
		category: ageCategory,
		address: address,
		startDate,
		meetings,
		students,
		room,
	}

	if (obj.category == '13-15') obj.category = '13-18'

	return obj
}

async function getAllDates(page, rowSelector) {
	const datesWithTime = await page.evaluate(selector => {
		const row = document.querySelector(selector)
		const dateElements = Array.from(row.querySelectorAll('th'))
		const allDatesWithTime = []
		dateElements.forEach(cell => {
			const text = cell.textContent.trim()
			const dateTimeRegex = /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}-\d{2}:\d{2})/
			const match = text.match(dateTimeRegex)
			if (match) {
				allDatesWithTime.push(match[1])
			}
		})
		return allDatesWithTime
	}, rowSelector)

	return datesWithTime
}

async function CreateCsv(group) {
	let meetingNumber = 1
	const description = `Numer sali: ${group.room}<br/>Liczba spotkań: ${group.meetings}<br/>Ilość uczniów: ${group.students}<br/>Pierwsze zajęcia: ${group.startDate}<br/><br/>ID: ${group.groupID}<br/>Nazwa: ${group.name}<br/>Wiek: ${group.category}<br/>Dzień: ${group.day}<br/>Godzina rozpoczęcia: ${group.startTime}<br/>Godzina zakończenia: ${group.endTime}<br/>Adres: ${group.address}`
	const privateEvent = isPrivateEvent ? 'TRUE' : 'FALSE'
	let csvResult = ''

	for (const lessonDate of group.dates) {
		const subject = `[${group.groupID}] ${group.name} - ${group.category} lat (${meetingNumber}/${group.meetings})`
		const [date, timeRange] = lessonDate.split('  ')
		const [startTime, endTime] = timeRange.split('-')

		const result = `${subject},${date},${startTime},${date},${endTime},FALSE,${description},${location},${privateEvent}\n`
		csvResult += result

		meetingNumber += 1
	}
	return csvResult
}

const fs = require('fs')
const puppeteer = require('puppeteer')
const email = 'x'
const pass = 'x'
const location = 'Myślenice  Gałczyńskiego 16'
const term = 'Lato 2024'
const day = 'Sobota'
const isPrivateEvent = false
const groups = []

;(async () => {
	const browser = await puppeteer.launch({ headless: false })
	const page = await browser.newPage()

	await page.goto('https://giganciprogramowaniaformularz.edu.pl/app/Login')
	await delay(1500)

	let result = await login(page, browser)
	if (!result) return
	await delay(1000)

	await selectTermAndGroup(page)

	await page.waitForSelector('mat-expansion-panel')
	const panels = await page.$$('mat-expansion-panel')

	console.log('Pobieram grupy z CRM..')
	for (const panel of panels) {
		const header = await panel.$('mat-expansion-panel-header')
		const headerText = await page.evaluate(header => header.textContent.trim(), header)

		const group = createObjectFromHeaderText(headerText)

		header.click()
		await delay(2000)

		const allDates = await getAllDates(page, 'tr.mat-header-row')
		group.dates = allDates

		groups.push(group)
	}

	console.log(groups)

	console.log('Grupy zostały pobrane.')
	await browser.close()
	console.log('Przetwarzanie grup..')

	const csvHeader = 'Subject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Location,Private\n'
	let csvBody = ''

	for (const group of groups) {
		const groupCsvResult = await CreateCsv(group)
		csvBody += groupCsvResult
	}

	console.log('Przetwarzanie zakończone.')
	console.log('Zapisywanie harmonogram do pliku CSV..')
	const csvFilePath = 'Terminarz giganci.csv'
	const csvData = csvHeader + csvBody
	fs.writeFile(csvFilePath, csvData, err => {
		if (err) {
			console.error('Wystąpił błąd podczas zapisu harmonogramu do pliku: ', error)
		}
	})
	console.log('Zapisywanie zakończone.')
})()
