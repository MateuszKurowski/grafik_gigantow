# Giants Schedule

## Description

The project aims to automate the process of retrieving class schedules, allowing for quick and easy import into a chosen calendar. The script retrieves classes for a specified day and semester, saving them to a CSV file that can be easily imported into the chosen calendar.

## Instructions

1. **Check Node.js Installation:**

   Make sure Node.js is installed on your computer. You can check this by typing `node -v` in the system console. If a version is returned, Node.js is already installed. Otherwise, download it from the [Node.js official website](https://nodejs.org/en/download/current).

2. **Download the Project:**

   Click on the **<> Code** button, then download the project as a ZIP file or clone the repository using the command `git clone https://github.com/MateuszKurowski/grafik_gigantow.git`.

3. **Install Dependencies:**

   After downloading the project, navigate to its directory in the terminal and run the command `npm install` to install the required dependencies.

4. **Configure the _config.json_ File:**

   Fill in the login credentials and information about the groups in the configuration file _config.json_, completing the fields below the "\_comment" field, which contain descriptions for each field.

5. **Run the Script:**

   After configuring the _config.json_ file, run the script by typing `node start.js` in the system console.

6. **Automated Script Execution:**

   Upon starting the program and loading the configuration file, a browser will open, which will automatically interact with the CRM. Do not click anything during script execution.

---

**Note:** There is one exception; sometimes, a login prompt randomly appears, as shown in the screenshot below. By default, the script waits for 2 seconds before starting its execution. During this time, you can manually close the window by clicking the [Cancel] button. If not closed, the script will terminate with an error. The window may appear multiple times in a row. We recommend manually clicking the [Cancel] button or running the script multiple times.

![Login Prompt in CRM](img/wyskakujaceOkno.png)

---

Once the script has finished executing, a file named **_Terminarz giganci.csv_** will appear in the main folder, which can be imported into the chosen calendar.

## Error Verification

If an error occurs, a file named _error.txt_ will be created in the main folder, containing a detailed description of the error and the line where it occurred. Please review this message. If the problem cannot be resolved, include the _error.txt_ file when reporting the error.

## Supported Calendars

- [x] Google Calendar

## Example Import to Google Calendar

1. Go to [Google Calendar](https://calendar.google.com/).
2. Open settings by clicking on the gear icon.
   ![Open Settings](img/ustawieniaGoogle.png)
3. Expand the _Add calendar_ option and select _Create new calendar_.
   ![Create New Calendar](img/nowyKalendarzGoogle.png)
4. Choose a name for the new calendar and click the _Create calendar_ button.
   ![Creating New Calendar](img/utworzKalendarzGoogle.png)
5. Go to the _Import/Export_ option.
   ![Import/Export Option](img/importujEksportujGoogle.png)
6. Select the _Select file from your computer_ option, choose the **_Terminarz giganci.csv_** file, and then click the _Import_ button.
   ![Import into Calendar](img/importGoogle.png)
7. Verify that the events match those in the CRM and that the event format is correct. If everything is in order, repeat the import process from step 5 and import the schedule into your main calendar.
