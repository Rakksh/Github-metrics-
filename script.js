import fetch from "node-fetch";
import { google } from "googleapis";

const GITHUB_TOKEN = "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"; // GitHub token
const REPO_NAME = "uweb/uw-storytelling-modules"; // Repository name in "owner/repo" format
const SPREADSHEET_ID = "1y8BXWXZCKcIJaMdBxxF9_zxo1TfJPWFlBjHxhR5Sj8c"; // Google Sheets ID
const SHEET_NAME = "Storytelling Modules"; // Replace with your sheet name (case-sensitive)
const REPOS = [
  { repo: "uweb/uw-storytelling-modules", sheet: "Storytelling Modules" },
  { repo: "uweb/uw_wp_theme", sheet: "UW WP Theme" },
  { repo: "uweb/uw_wp_theme_child", sheet: "UW WP Child Theme" },
  { repo: "uweb/uw-marketo-templates", sheet: "Marketo Templates" },
  { repo: "uweb/uw-theme-static", sheet: "UW Theme Static Files" },
];

// ====== Get Last Date from Google Sheets ======
async function getLastDateFromSheet(sheetName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    // Fetch the last date from column A
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:A`, // Entire column A
    });

    const rows = response.data.values || [];
    const lastDateRow = rows[rows.length - 1]; // Last non-empty row in column A
    const lastDate = lastDateRow ? new Date(lastDateRow[0]) : null;

    if (!lastDate) {
      console.log(`No date found in sheet "${sheetName}". Using today as the start date.`);
      return new Date();
    }

    console.log(`Last date in sheet "${sheetName}":`, lastDate);
    return lastDate;
  } catch (error) {
    console.error(`Error fetching last date from sheet "${sheetName}":`, error);
    return new Date(); // Default to today if error occurs
  }
}


// ====== Get Sheet ID ======
async function getSheetId(sheetName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = response.data.sheets.find(
      (s) => s.properties.title === sheetName
    );

    if (sheet) {
      return sheet.properties.sheetId;
    } else {
      throw new Error(`Sheet with name "${sheetName}" not found.`);
    }
  } catch (error) {
    console.error("Error fetching sheet ID:", error);
    throw error;
  }
}

// ====== Get Last Row Data ======
async function getLastRowData(sheetName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    // Fetch the last row data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:K`, // Fetch all relevant columns
    });

    const rows = response.data.values || [];
    const lastRow = rows[rows.length - 1] || []; // Last non-empty row
    return {
      rowIndex: rows.length, // Row index (1-based)
      stars: parseInt(lastRow[4] || 0, 10), // Column E
      watchers: parseInt(lastRow[5] || 0, 10), // Column F
      forks: parseInt(lastRow[6] || 0, 10), // Column G
    };
  } catch (error) {
    console.error(`Error fetching last row data from sheet "${sheetName}":`, error);
    return { rowIndex: 0, stars: 0, watchers: 0, forks: 0 }; // Return defaults on error
  }
}


// ====== Delete Last Row ======
async function deleteLastRow(sheetName, rowIndex) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const sheetId = await getSheetId(sheetName); // Fetch the correct sheetId dynamically

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId, // Use the dynamically fetched sheetId
                dimension: "ROWS",
                startIndex: rowIndex - 1, // Google Sheets uses zero-based indexing
                endIndex: rowIndex, // Delete the last row
              },
            },
          },
        ],
      },
    });

    console.log(`Successfully deleted row ${rowIndex} from sheet "${sheetName}".`);
  } catch (error) {
    console.error(`Error deleting last row from sheet "${sheetName}":`, error);
  }
}

// ====== Calculate and Append Totals ======
async function calculateAndAppendTotals(sheetName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    // Fetch all relevant columns for the given sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:K`,
    });

    const rows = response.data.values || [];

    // Calculate totals
    const totalStars = rows.reduce((acc, row) => acc + (parseInt(row[4]) || 0), 0); // Column E
    const totalWatchers = rows.reduce((acc, row) => acc + (parseInt(row[5]) || 0), 0); // Column F
    const totalForks = rows.reduce((acc, row) => acc + (parseInt(row[6]) || 0), 0); // Column G

    console.log(
      `Totals for sheet "${sheetName}" - Stars: ${totalStars}, Watchers: ${totalWatchers}, Forks: ${totalForks}`
    );

    // Append totals to the sheet
    const totalsRow = [
      "", 
      "",
      "",
      "",
      totalStars, // Total Stars
      totalWatchers, // Total Watchers
      totalForks, // Total Forks
      "", // Other columns left empty
      "",
      "",
      "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [totalsRow],
      },
    });

    console.log(`Totals successfully appended to sheet "${sheetName}"!`);
  } catch (error) {
    console.error(
      `Error calculating and appending totals for sheet "${sheetName}":`,
      error
    );
  }
}

// ====== Fetch Repository Metrics ======
async function fetchRepoMetrics(repoName, startDate, lastRowData) {
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  };

  function normalizeToMidnight(date) {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0); // Normalize to midnight UTC
    return normalized;
  }

  try {
    const repoResponse = await fetch(`https://api.github.com/repos/${repoName}`, { headers });
    const repoData = await repoResponse.json();

    const viewsResponse = await fetch(`https://api.github.com/repos/${repoName}/traffic/views`, { headers });
    const viewsData = await viewsResponse.json();

    const clonesResponse = await fetch(`https://api.github.com/repos/${repoName}/traffic/clones`, { headers });
    const clonesData = await clonesResponse.json();

    const releasesResponse = await fetch(`https://api.github.com/repos/${repoName}/releases`, { headers });
    const releasesData = await releasesResponse.json();

    const issuesResponse = await fetch(`https://api.github.com/repos/${repoName}/issues?state=all`, { headers });
    const issuesData = await issuesResponse.json();

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Calculate the 7-day range

    const viewsLast7Days = viewsData.views.filter(view => {
      const viewDate = new Date(view.timestamp);
      return normalizeToMidnight(viewDate) >= normalizeToMidnight(startDate) && normalizeToMidnight(viewDate) <= normalizeToMidnight(endDate);
    }).reduce((acc, view) => acc + view.count, 0);

    const uniqueVisitorsLast7Days = viewsData.views
      ? viewsData.views.filter(view => {
          const viewDate = new Date(view.timestamp);
          return normalizeToMidnight(viewDate) >= normalizeToMidnight(startDate) && normalizeToMidnight(viewDate) <= normalizeToMidnight(endDate);
        }).reduce((acc, view) => acc + view.uniques, 0)
      : 0;

    const clonesLast7Days = clonesData.clones
      ? clonesData.clones.filter(clone => {
          const cloneDate = new Date(clone.timestamp);
          return cloneDate >= startDate && cloneDate <= endDate;
        }).reduce((acc, clone) => acc + clone.count, 0)
      : 0;

    // Calculate changes
    const starsDiff = repoData.stargazers_count > lastRowData.stars ? repoData.stargazers_count - lastRowData.stars : 0;
    const watchersDiff = repoData.subscribers_count > lastRowData.watchers ? repoData.subscribers_count - lastRowData.watchers : 0;
    const forksDiff = repoData.forks > lastRowData.forks ? repoData.forks - lastRowData.forks : 0;

    // Releases logic
    const releasesInRange = releasesData.filter(release => {
      const releaseDate = new Date(release.published_at);
      return releaseDate >= startDate && releaseDate <= endDate;
    });
    const releasesDiff = releasesInRange.length;

    // Issues logic
    const issuesOpenedInRange = issuesData.filter(issue => {
      const createdDate = new Date(issue.created_at);
      return createdDate >= startDate && createdDate <= endDate;
    }).length;

    const issuesClosedInRange = issuesData.filter(issue => {
      const closedDate = issue.closed_at ? new Date(issue.closed_at) : null;
      return closedDate && closedDate >= startDate && closedDate <= endDate;
    }).length;

    // Notes
    let notes = "";
    if (releasesDiff > 0) {
      const latestRelease = releasesInRange[0];
      const releaseName = latestRelease.name || latestRelease.tag_name;
      const releaseDate = new Date(latestRelease.published_at).toISOString().split("T")[0];
      notes += `New release: ${releaseName} on ${releaseDate}. `;
    }
    if (issuesOpenedInRange > 0) {
      notes += `New issues opened: ${issuesOpenedInRange}. `;
    }
    if (issuesClosedInRange > 0) {
      notes += `New issues closed: ${issuesClosedInRange}. `;
    }

    return {
      Date_Start: startDate.toISOString().split("T")[0],
      Visitors: uniqueVisitorsLast7Days,
      Views: viewsLast7Days,
      Clones: clonesLast7Days,
      Stars: starsDiff,
      Watchers: watchersDiff,
      Forks: forksDiff,
      Releases: releasesDiff,
      Issues_Opened: issuesOpenedInRange,
      Issues_Closed: issuesClosedInRange,
      Notes: notes,
    };
  } catch (error) {
    console.error("Error fetching repository metrics:", error);
    return null;
  }
}


// ====== Append Data to Google Sheets ======
async function appendToGoogleSheet(metrics, sheetName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const values = [
      [
        metrics.Date_Start,
        metrics.Visitors,
        metrics.Views,
        metrics.Clones,
        metrics.Stars,
        metrics.Watchers,
        metrics.Forks,
        metrics.Releases,
        metrics.Issues_Opened,
        metrics.Issues_Closed,
        metrics.Notes,
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values,
      },
    });

    console.log(`Metrics successfully appended to sheet "${sheetName}"!`);
  } catch (error) {
    console.error(`Error appending data to sheet "${sheetName}":`, error);
  }
}



// ====== Main Execution ======
(async () => {
  try {
    for (const { repo, sheet } of REPOS) {
      console.log(`Processing repository "${repo}" for sheet "${sheet}"...`);

      const lastRowData = await getLastRowData(sheet);
      if (lastRowData.rowIndex > 1) {
        await deleteLastRow(sheet, lastRowData.rowIndex); // Delete the last row
      }

      const lastDate = await getLastDateFromSheet(sheet);
      const nextStartDate = new Date(lastDate);
      nextStartDate.setDate(lastDate.getDate() + 7); // Move to the next week

      const metrics = await fetchRepoMetrics(repo, nextStartDate, lastRowData);
      if (metrics) {
        console.log(`Repository Metrics for "${repo}":`, metrics);
        await appendToGoogleSheet(metrics, sheet);
      }

      // Calculate and append totals
      await calculateAndAppendTotals(sheet);
    }
  } catch (error) {
    console.error("Error in main execution:", error);
  }
})();

