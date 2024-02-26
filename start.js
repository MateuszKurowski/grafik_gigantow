const fs = require('fs')
const puppeteer = require('puppeteer')
let config
const groups = []

async function loadConfig() {
	try {
		const data = fs.readFileSync('config.json', 'utf8')
		config = JSON.parse(data)
		console.log('Plik konfiguracyjny został wczytany.')
		console.log()
	} catch (err) {
		throw new Error(`Błąd wczytywania pliku konfiguracyjnego: ${err}`)
	}
}

async function checkConfig() {
	if (config['email'] == 'example@example.com' || config['password'] == 'password123') {
		throw new Error(
			"Aby pobrać harmonogram zajęć najpierw otwórz plik config.json i uzupełnij pola poniżej pola '_comment'."
		)
	}

	const requiredFields = ['email', 'password', 'location', 'semester', 'days']

	requiredFields.forEach(field => {
		if (!config.hasOwnProperty(field) || !config[field]) {
			throw new Error(`Pole "${field}" jest puste lub nie istnieje.`)
		}
	})

	if (!config.hasOwnProperty('isPrivateEvent') || typeof config['isPrivateEvent'] !== 'boolean') {
		config.isPrivateEvent = false
	}

	if (
		!config.hasOwnProperty('timeBeforeLoginInMilliseconds') ||
		typeof config['timeBeforeLoginInMilliseconds'] !== 'number'
	) {
		config.timeBeforeLoginInMilliseconds = 2000
	}

	const defaultEventDescriptionConfig = {
		roomNumber: true,
		lessonNumber: true,
		numberOfLessons: true,
		numberOfStudents: true,
		firstLessonDate: true,
		groupId: true,
		courseName: true,
		groupAge: true,
		dayOfWeek: true,
		startTime: true,
		endTime: true,
		location: true,
	}

	if (!config.hasOwnProperty('eventDescriptionConfig')) {
		config.eventDescriptionConfig = defaultEventDescriptionConfig
	} else {
		const descriptionConfig = config.eventDescriptionConfig
		for (const [key, value] of Object.entries(defaultEventDescriptionConfig)) {
			if (!descriptionConfig.hasOwnProperty(key) || typeof descriptionConfig[key] !== 'boolean') {
				descriptionConfig[key] = true
			}
		}
	}

	const defaultEventNameConfig = {
		groupId: true,
		groupAge: true,
		lessonNumber: true,
	}

	if (!config.hasOwnProperty('eventNameConfig')) {
		config.eventNameConfig = defaultEventNameConfig
	} else {
		const nameConfig = config.eventNameConfig
		for (const [key, value] of Object.entries(defaultEventNameConfig)) {
			if (!nameConfig.hasOwnProperty(key) || typeof nameConfig[key] !== 'boolean') {
				nameConfig[key] = true
			}
		}
	}
}

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

async function selectTermAndLocation(page) {
	try {
		let optionId = await getParentOptionId(page, config.semester, '#mat-select-6', 'mat-option')
		await page.click(`#${optionId}`)
	} catch (error) {
		throw new Error(`Nie znaleziono wybranego semestru: ${config.semester}`)
	}

	try {
		optionId = await getParentOptionId(page, config.location, 'input[id="mat-input-0"]', 'mat-option')
		await page.click(`#${optionId}`)
	} catch (error) {
		throw new Error(`Nie znaleziono wybranej lokalizacji: ${config.location}`)
	}
}

async function selectDayAndSearch(page, day) {
	try {
		day = await translateDay(day)
		day = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()

		optionId = await getParentOptionId(page, day, '#mat-select-0', 'mat-option')
		await page.click(`#${optionId}`)
	} catch (error) {
		throw new Error(`Nie znaleziono wybranego dnia: ${day}`)
	}

	await page.click('.orangeButton')
}

async function translateDay(day) {
	const englishToPolish = {
		monday: 'poniedziałek',
		tuesday: 'wtorek',
		wednesday: 'środa',
		thursday: 'czwartek',
		friday: 'piątek',
		saturday: 'sobota',
		sunday: 'niedziela',
	}

	if (englishToPolish.hasOwnProperty(day.toLowerCase())) {
		return englishToPolish[day.toLowerCase()]
	} else {
		return day
	}
}

async function login(page) {
	await page.waitForSelector('input[formcontrolname="username"]')
	await page.type('input[formcontrolname="username"]', config.email)
	await page.type('input[formcontrolname="password"]', config.password)
	await delay(500)
	const enteredValue = await page.$eval('input[formcontrolname="username"]', input => input.value)
	if (enteredValue !== config.email) {
		throw new Error(
			'Wykonywanie skryptu zablokowane przez wyskakujące okno. Zamknij je klikając przycisk [Cancel] lub spróbuj ponownie. Okno wyskakuje losowo czasami nawet pare razy pod rząd.'
		)
	}

	await Promise.all([page.click('button[data-testid="login-button"]'), page.waitForNavigation()])
	await page.goto('https://giganciprogramowaniaformularz.edu.pl/app/ListaObecnosci')
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

	const [
		,
		groupID,
		startTime,
		endTime,
		dayOfWeek,
		courseName,
		ageCategory,
		location,
		firstLessonDate,
		numberOfLessons,
		numberOfStudents,
		roomNumber,
	] = match

	const obj = {
		groupID,
		startTime,
		endTime,
		dayOfWeek,
		courseName,
		groupAge: ageCategory,
		location: location,
		firstLessonDate,
		numberOfLessons,
		numberOfStudents,
		roomNumber,
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

async function CreateEventDescription(group, lessonNumber) {
	let description = ''

	if (config.eventDescriptionConfig.roomNumber) {
		description += `Numer sali: ${group.roomNumber}<br/>`
	}
	if (config.eventDescriptionConfig.lessonNumber) {
		description += `Numer lekcji: ${lessonNumber}<br/>`
	}
	if (config.eventDescriptionConfig.numberOfLessons) {
		description += `Liczba spotkań: ${group.numberOfLessons}<br/>`
	}
	if (config.eventDescriptionConfig.numberOfStudents) {
		description += `Ilość uczniów: ${group.numberOfStudents}<br/>`
	}
	if (config.eventDescriptionConfig.firstLessonDate) {
		const newDate = formatDate(group.firstLessonDate)
		description += `Pierwsze zajęcia: ${newDate}<br/>`
	}
	description += '<br/>'
	if (config.eventDescriptionConfig.groupId) {
		description += `ID: ${group.groupID}<br/>`
	}
	if (config.eventDescriptionConfig.courseName) {
		description += `Nazwa: ${group.courseName}<br/>`
	}
	if (config.eventDescriptionConfig.groupAge) {
		description += `Wiek: ${group.category}<br/>`
	}
	if (config.eventDescriptionConfig.dayOfWeek) {
		description += `Dzień: ${group.dayOfWeek}<br/>`
	}
	if (config.eventDescriptionConfig.startTime) {
		description += `Godzina rozpoczęcia: ${group.startTime}<br/>`
	}
	if (config.eventDescriptionConfig.endTime) {
		description += `Godzina zakończenia: ${group.endTime}<br/>`
	}
	if (config.eventDescriptionConfig.location) {
		description += `Adres: ${group.location}<br/>`
	}

	return description
}

async function CreateEventName(group, lessonNumber) {
	let name = ''
	if (config.eventNameConfig.groupId) {
		name += `[${group.groupID}] `
	}
	name += group.courseName
	if (config.eventNameConfig.groupAge) {
		name += ` - ${group.groupAge} lat`
	}
	if (config.eventNameConfig.lessonNumber) {
		name += ` ${lessonNumber}`
	}

	return name
}

async function CreateCsv(group) {
	let meetingNumber = 1
	const privateEvent = config.isPrivateEvent ? 'TRUE' : 'FALSE'
	let csvResult = ''

	for (const lessonDate of group.dates) {
		const lessonNumber = `(${meetingNumber}/${group.meetings})`
		const subject = await CreateEventName(group, lessonNumber)
		const description = await CreateEventDescription(group, meetingNumber)

		const [date, timeRange] = lessonDate.split('  ')
		const [startTime, endTime] = timeRange.split('-')

		const result = `"${subject}","${date}","${startTime}","${date}","${endTime}",FALSE,"${description}","${config.location}","${privateEvent}"\n`

		csvResult += result

		meetingNumber += 1
	}
	return csvResult
}

async function formatDate(date) {
	try {
		const dateObject = new Date(dateString)

		const day = dateObject.getDate()
		const month = dateObject.getMonth() + 1
		const year = dateObject.getFullYear()

		return `${day}/${month}/${year}`
	} catch (error) {
		return date
	}
}

async function main() {
	await loadConfig()
	await checkConfig()

	const browser = await puppeteer.launch({ headless: false })
	const page = await browser.newPage()

	await page.goto('https://giganciprogramowaniaformularz.edu.pl/app/Login')
	await delay(config.timeBeforeLoginInMilliseconds)

	await login(page, browser)
	await delay(1000)

	await selectTermAndLocation(page)

	const days = config.days
		.toLowerCase()
		.split(',')
		.map(day => day.trim())

	for (const day of days) {
		await selectDayAndSearch(page, day)

		await page.waitForSelector('mat-expansion-panel')
		const panels = await page.$$('mat-expansion-panel')

		console.log(`Pobieram grupy z CRM dla dnia: ${day}..`)
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
	}

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
	fs.writeFileSync(csvFilePath, csvData, err => {
		if (err) {
			throw new Error(`Wystąpił błąd podczas zapisu harmonogramu do pliku: ${err}`)
		}
	})
	console.log('Zapisywanie zakończone.')
}

;(async () => {
	try {
		await main()
	} catch (error) {
		const errorMessage = error.message
		const stackTrace = error.stack

		const separator = '-'.repeat(20)

		const messageToWrite = `${errorMessage}\n\n${separator}\n\n${stackTrace}`

		fs.writeFileSync('blad.txt', messageToWrite)
		console.error('Błąd:', error.message)
	}
	process.exit(1)
})()
