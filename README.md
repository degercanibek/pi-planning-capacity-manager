# PI Planning Capacity Management

## Overview
A professional capacity planning tool designed specifically for PI (Program Increment) Planning. This tool helps teams manage capacity, track availability, and plan resources effectively across multiple teams.

## Features

### 👥 Employee & Team Management (Roster Tab)
- **Employee Management**: Add and manage individual employees with detailed information
  - Full name, role, available hours per day
  - Story points capacity per iteration
  - Team assignment
  - Personal off days per employee
- **Team Management**: Create and organize teams
  - Team name and description
  - Assign multiple employees to teams
  - Team-level off days
  - Real-time capacity calculations per team
- **Bulk Operations**: Select and delete multiple employees at once
- **Dynamic Updates**: Employee changes automatically reflect in their assigned teams

### 📊 PI Planning Capacity (Capacity Tab)
- **PI Configuration**: Set up Program Increment parameters
  - PI name, start date, end date
  - Iteration duration (weeks)
- **Capacity Summary**: View comprehensive capacity metrics
  - Total duration and working days
  - Number of iterations
  - Total teams and employees
  - Total person-hours and story points
- **Team Capacity Details**: Detailed breakdown per team
  - Members count
  - Hours per day and total hours
  - Story points per iteration and total SP

### 📅 Timeline & Calendar (Timeline Tab)
- **Holiday Management**: Comprehensive holiday and leave tracking
  - Public holidays (affects all employees)
  - Team off days (affects specific teams)
  - Personal off days (affects individual employees)
  - Exclude weekends option
- **Iteration Timeline**: Visual timeline representation
  - Clickable iterations showing member capacity details
  - Working days, weekends, and holidays
  - Team filtering with multi-select
  - Color-coded day types
  - Individual member off days with reasons

### 🎨 Design
- **Corporate Colors**: Red (#e30a17), black, gray tones, and white
- **Clean Interface**: Minimalist, professional design
- **Sticky Navigation**: Header and tabs stay visible on scroll
- **Responsive Layout**: Works on desktop and mobile devices
- **English Only**: Single language interface

### 💾 Data Management
- **Single JSON File**: All data (config, teams, employees, holidays) in one file
- **Unified Import/Export**: Single button in header for all data operations
- **Local Storage**: Data persists in browser
- **Default Data**: Loads from data.json on first run
- **Complete Backup**: One export = entire application data
- **Real-time Sync**: Changes reflect across all views

## File Structure

```
Capacity Management/
├── index.html                    # Main HTML file
├── documentation.html            # Comprehensive documentation
├── data/
│   └── data.json                # Single unified data file (config, teams, employees, holidays)
├── scripts/
│   ├── script.js                # Main application logic
│   └── documentation.js         # Documentation page logic
├── styles/
│   ├── styles.css               # Main CSS styles
│   └── documentation.css        # Documentation page styles
└── README.md                    # This file
```

## Getting Started

### 1. Open the Application
Simply open `index.html` in a modern web browser (Chrome, Firefox, Safari, or Edge).

### 2. Initial Load
- On first run, the application automatically loads data from `data/data.json`
- Sample teams, employees, PI config, and holidays are pre-configured
- Data is then saved to browser's localStorage for persistence

### 3. Configure Your PI
1. Go to **"PI Planning Capacity"** tab
2. Fill in:
   - PI Name (e.g., "PI 2025-Q1")
   - Start Date
   - End Date
   - Iteration Duration (weeks, default: 2)
3. Click **"Calculate Capacity"**

### 4. Manage Off Days
1. **Personal Off Days**: Click on employee's "off days" button in Employees table
2. **Team Off Days**: Managed in team settings
3. **Public Holidays**: Pre-loaded from `holidays.json`, can be modified in code

### 5. Import/Export Plan
- **Export Plan**: Click "Export Plan" button in header to download `capacity-data.json`
- **Import Plan**: Click "Import Plan" button in header to upload and restore all data
- Single unified file includes: config, teams, members, off days, and holidays
- Confirm dialog before importing to prevent accidental data loss

### 6. View Iteration Details
1. Go to **"Timeline & Calendar"** tab
2. Filter teams using multi-select dropdown
3. Click on any iteration card to see:
   - Total capacity and working days
   - Individual member breakdown
   - Off days with reasons per member

## Usage Guide

### Adding Employees
1. Go to **"Employees & Teams"** tab
2. Click **"+ Add Employee"**
3. Fill in:
   - Full Name
   - Role (select from dropdown)
   - Hours per day (e.g., 8)
   - SP Capacity per sprint (e.g., 25)
   - Team (optional)
4. Click **"Save"**

### Creating Teams
1. Go to **"Employees & Teams"** tab
2. Click **"+ Add Team"**
3. Enter team name and description
4. Select team members from the checkbox list
5. Click **"Save"**

**Note**: Employees are automatically assigned to teams when selected. If an employee is assigned to a new team, they are removed from the previous team.

### Viewing Capacity
1. Configure your PI in the **"PI Planning Capacity"** tab
2. View the summary cards showing:
   - Total duration and working days
   - Number of sprints
   - Total teams and employees
   - Total hours and story points
3. Scroll down to see detailed capacity breakdown per team

### Managing the Timeline
1. Go to **"Timeline & Calendar"** tab
2. Add holidays/leaves as needed
3. View the Gantt chart showing:
   - **White**: Working days
   - **Light Gray**: Weekends
   - **Red**: Holidays

## Data Management

### Exporting Plan
- **Export Plan**: Click "📥 Export Plan" button in the header (top right)
- Downloads complete plan data as `capacity-data.json`
- Includes: PI config, teams, members, off days, and public holidays
- **One file = complete backup** of all planning data

Store these files safely to backup your data or share with team members.

### Importing Plan
- **Import Plan**: Click "📤 Import Plan" button in the header (top right)
- Upload previously exported `capacity-data.json` file
- Confirmation dialog appears before replacing data
- **Replaces all current data** with imported plan
- Shows summary of imported items (teams, employees, holidays)

### Data Structure

The application uses a single unified JSON file (`data/data.json`):

```json
{
  "config": {
    "pi": {
      "name": "PI 2025-Q1",
      "startDate": "2025-01-06",
      "endDate": "2025-03-28",
      "iterationDurationWeeks": 2
    },
    "workingDays": {
      "hoursPerDay": 8,
      "daysPerWeek": 5
    }
  },
  "publicHolidays": [
    {
      "date": "2025-01-01",
      "name": "New Year's Day"
    }
  ],
  "organization": {
    "teams": [
      {
        "id": "team_001",
        "name": "Development Team",
        "description": "Main development team",
        "offDays": [
          {
            "date": "2025-02-10",
            "reason": "Team Workshop"
          }
        ],
        "members": [
          {
            "id": "emp_001",
            "name": "John Doe",
            "role": "Developer",
            "hoursPerDay": 8,
            "spCapacity": 25,
            "offDays": [
              {
                "date": "2025-01-15",
                "reason": "Personal Leave"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## Technical Details

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Data Storage
- Uses browser's `localStorage` API
- Data persists between sessions
- Each browser/device has independent storage

### Capacity Calculations
- **Working Days**: Total days minus weekends, public holidays, team offs, and personal offs
- **Total Hours**: Sum of all employee hours × working days (accounting for individual availability)
- **Total Story Points**: Sum of all employee SP capacity × number of iterations
- **Team Capacity**: Aggregated from assigned team members
- **Iteration Details**: Shows per-member working days, off days with reasons, and total capacity

## Customization

### Adding New Roles
Edit the role dropdown in `index.html`:
```html
<option value="Your Role">Your Role</option>
```

### Modifying Iteration Duration
Default is 2 weeks. Can be changed in PI Configuration (1-4 weeks supported).

### Adding Public Holidays
Edit `data/data.json` and add to publicHolidays array:
```json
{
  "date": "YYYY-MM-DD",
  "name": "Holiday Name"
}
```

### Theme Colors
All colors are defined in `styles/styles.css` under `:root` variables:
```css
--primary-red: #e30a17;
--primary-black: #1a1a1a;
/* etc. */
```

## Tips

1. **Single data file** - All data (config, teams, employees, holidays) in `data/data.json`
2. **Data loads automatically** from data.json on first run
3. **Export regularly** - Click "Export Plan" in header for complete backup
4. **Import confirmation** - Always confirms before overwriting data
5. **Use bulk delete** to quickly remove multiple employees (select with checkboxes)
6. **Click on iterations** in timeline to see detailed capacity breakdown
7. **Filter teams** in timeline view to focus on specific teams
8. **Personal offs** are managed per employee, **team offs** affect entire team
9. **Calculate capacity** after any changes to see updated metrics
10. **One export = everything** - No need to export teams and employees separately

## Troubleshooting

### Data Not Persisting
- Check if browser allows localStorage
- Try a different browser
- Clear browser cache and re-import plan

### Wrong Capacity Calculations
- Verify PI dates are correct
- Check if holidays are properly configured
- Ensure all employees have valid hours and SP capacity

### Import Errors
- Verify JSON file format
- Check for missing required fields
- Ensure IDs are unique

---

**Version**: 1.0  
**Last Updated**: December 2025
