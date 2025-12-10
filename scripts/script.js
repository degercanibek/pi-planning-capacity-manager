// Data structures
let organizationData = {
    teams: []
};
let config = {
    pi: {
        name: '',
        startDate: '',
        endDate: '',
        iterationDurationWeeks: 2
    },
    workingDays: {
        hoursPerDay: 8,
        daysPerWeek: 5
    }
};
let holidaysData = {
    publicHolidays: []
};

// Backward compatible properties (dynamically generated)
let employees = [];
let teams = [];
let holidays = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    syncLegacyData();
    renderEmployees();
    renderTeams();
    updateTeamSelectors();
    renderTeamFilters();
});

// Load data from localStorage or default file
async function loadData() {
    const savedData = localStorage.getItem('pi_data');

    if (savedData) {
        // Load from localStorage
        const data = JSON.parse(savedData);
        config = data.config || config;
        holidaysData = { publicHolidays: data.publicHolidays || [] };
        organizationData = data.organization || { teams: [] };
    } else {
        // Start with empty defaults - no external data file
        console.log('Starting with empty data');
    }

    updatePIForm();
}

// Sync legacy data arrays from organization structure
function syncLegacyData() {
    // Build employees array from organization
    employees = [];
    organizationData.teams.forEach(team => {
        team.members.forEach(member => {
            employees.push({
                ...member,
                teamId: team.id,
                teamName: team.name
            });
        });
    });

    // Build teams array from organization
    teams = organizationData.teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        members: team.members.map(m => m.id),
        offDays: team.offDays || []
    }));

    // Build holidays array (for backward compatibility with personal/team offs)
    holidays = [
        ...holidaysData.publicHolidays.map((h, index) => ({ 
            id: h.id || `holiday_${index}_${Date.now()}`,
            type: 'public',
            name: h.name,
            startDate: h.date,
            endDate: h.date,
            excludeWeekends: false
        }))
    ];

    // Add personal off days from members
    organizationData.teams.forEach(team => {
        team.members.forEach(member => {
            if (member.offDays && member.offDays.length > 0) {
                member.offDays.forEach((off, index) => {
                    holidays.push({
                        id: off.id || `personal_${member.id}_${index}_${Date.now()}`,
                        type: 'personal',
                        name: off.reason || 'Personal Leave',
                        startDate: off.date,
                        endDate: off.date,
                        excludeWeekends: false,
                        employeeId: member.id
                    });
                });
            }
        });
        // Add team off days
        if (team.offDays && team.offDays.length > 0) {
            team.offDays.forEach((off, index) => {
                holidays.push({
                    id: off.id || `team_${team.id}_${index}_${Date.now()}`,
                    type: 'team',
                    name: off.reason || 'Team Off',
                    startDate: off.date,
                    endDate: off.date,
                    excludeWeekends: false,
                    teamId: team.id
                });
            });
        }
    });
}

// Save data to localStorage
function saveData() {
    // Sync changes back to organization structure before saving
    syncBackToOrganization();
    
    // Save as single JSON structure
    const data = {
        config: config,
        publicHolidays: holidaysData.publicHolidays,
        organization: organizationData
    };
    
    localStorage.setItem('pi_data', JSON.stringify(data));
}

// Sync changes from legacy arrays back to organization structure
function syncBackToOrganization() {
    // Update members in organization from employees array
    employees.forEach(emp => {
        const team = organizationData.teams.find(t => t.id === emp.teamId);
        if (team) {
            const memberIndex = team.members.findIndex(m => m.id === emp.id);
            if (memberIndex >= 0) {
                // Update member with personal off days
                const personalOffs = holidays
                    .filter(h => h.type === 'personal' && h.employeeId === emp.id)
                    .map(h => ({ 
                        id: h.id,
                        date: h.startDate, 
                        reason: h.name || 'Off Day' 
                    }));
                
                team.members[memberIndex] = {
                    id: emp.id,
                    name: emp.name,
                    role: emp.role,
                    hoursPerDay: emp.hoursPerDay,
                    spCapacity: emp.spCapacity,
                    offDays: personalOffs
                };
            }
        }
    });

    // Update team off days
    organizationData.teams.forEach(team => {
        const teamOffs = holidays
            .filter(h => h.type === 'team' && h.teamId === team.id)
            .map(h => ({ 
                id: h.id,
                date: h.startDate, 
                reason: h.name || 'Team Off' 
            }));
        team.offDays = teamOffs;
    });

    // Update public holidays
    const publicHols = holidays
        .filter(h => h.type === 'public')
        .map(h => ({ 
            id: h.id,
            date: h.startDate, 
            name: h.name 
        }));
    holidaysData.publicHolidays = publicHols;
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Refresh content based on tab
    if (tabName === 'roster') {
        renderEmployees();
        renderTeams();
    } else if (tabName === 'capacity') {
        renderCapacitySummary();
    } else if (tabName === 'holidays') {
        renderHolidays();
    } else if (tabName === 'timeline') {
        renderTeamFilters();
        renderGanttChart();
    }
}

// ============ EMPLOYEES ============

// Track current employee teams during edit
let currentEmployeeTeams = [];

function addEmployeeToTeam() {
    const select = document.getElementById('employee-team-select');
    const teamId = select.value;
    
    if (!teamId) return;
    
    const role = document.getElementById('employee-role').value;
    const allowedRoles = ['Product Owner', 'Product Designer'];
    
    // Check if employee can be in multiple teams
    if (currentEmployeeTeams.length > 0 && !allowedRoles.includes(role)) {
        alert('Only Product Owners and Product Designers can be in multiple teams.\n\nPlease remove the current team assignment first.');
        return;
    }
    
    if (!currentEmployeeTeams.includes(teamId)) {
        currentEmployeeTeams.push(teamId);
        updateEmployeeTeamsDisplay();
    }
    
    select.value = '';
}

function removeEmployeeFromTeam(teamId) {
    currentEmployeeTeams = currentEmployeeTeams.filter(id => id !== teamId);
    updateEmployeeTeamsDisplay();
}

function updateEmployeeTeamsDisplay() {
    const container = document.getElementById('employee-teams-list');
    const select = document.getElementById('employee-team-select');
    
    // Update the dropdown
    select.innerHTML = '<option value="">Select team...</option>' +
        teams
            .filter(team => !currentEmployeeTeams.includes(team.id))
            .map(team => `<option value="${team.id}">${team.name}</option>`)
            .join('');
    
    // Update the teams list
    if (currentEmployeeTeams.length === 0) {
        container.innerHTML = '<div class="empty-state-text">Not assigned to any team.</div>';
        return;
    }
    
    container.innerHTML = currentEmployeeTeams.map(teamId => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return '';
        return `
            <div class="selected-member-item">
                <span class="member-info">
                    <strong>${team.name}</strong>
                </span>
                <button type="button" class="btn-remove-member" onclick="removeEmployeeFromTeam('${teamId}')" title="Remove">✕</button>
            </div>
        `;
    }).join('');
}

// Track selected employees for bulk operations
let selectedEmployeeIds = [];

function renderEmployees() {
    const tbody = document.getElementById('employees-tbody');
    
    if (employees.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <div class="empty-state-icon">👤</div>
                    <div class="empty-state-text">No employees yet. Click "Add Employee" to get started.</div>
                </td>
            </tr>
        `;
        updateBulkDeleteButton();
        return;
    }

    tbody.innerHTML = employees.map(emp => {
        // Find all teams this employee is in
        const employeeTeams = teams.filter(t => t.members.includes(emp.id));
        let teamDisplay;
        
        if (employeeTeams.length === 0) {
            teamDisplay = '<span style="color: var(--thy-gray);">No Team</span>';
        } else if (employeeTeams.length === 1) {
            teamDisplay = employeeTeams[0].name;
        } else {
            // Multiple teams - show as comma-separated list
            teamDisplay = employeeTeams.map(t => t.name).join(', ');
        }
        
        // Count off days for this employee
        const employeeOffDays = holidays.filter(h => h.type === 'personal' && h.employeeId === emp.id).length;
        
        const isSelected = selectedEmployeeIds.includes(emp.id);
        
        return `
            <tr>
                <td style="text-align: center;">
                    <input type="checkbox" 
                           class="employee-checkbox" 
                           value="${emp.id}" 
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleEmployeeSelection('${emp.id}', this.checked)">
                </td>
                <td><strong>${emp.name}</strong></td>
                <td>${emp.role}</td>
                <td>${emp.hoursPerDay}h</td>
                <td>${emp.spCapacity} SP</td>
                <td>${teamDisplay}</td>
                <td>
                    <button class="btn btn-sm" onclick="manageEmployeeOffDays('${emp.id}')" style="font-size: 11px; padding: 4px 8px;">
                        ${employeeOffDays} ${employeeOffDays === 1 ? 'day' : 'days'}
                    </button>
                </td>
                <td>
                    <button class="action-btn" onclick="editEmployee('${emp.id}')" title="Edit">✏️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    updateBulkDeleteButton();
    updateSelectAllCheckbox();
}

function toggleEmployeeSelection(empId, isChecked) {
    if (isChecked) {
        if (!selectedEmployeeIds.includes(empId)) {
            selectedEmployeeIds.push(empId);
        }
    } else {
        const index = selectedEmployeeIds.indexOf(empId);
        if (index > -1) {
            selectedEmployeeIds.splice(index, 1);
        }
    }
    updateBulkDeleteButton();
    updateSelectAllCheckbox();
}

function toggleAllEmployees(isChecked) {
    if (isChecked) {
        selectedEmployeeIds = employees.map(e => e.id);
    } else {
        selectedEmployeeIds = [];
    }
    renderEmployees();
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-employees');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = employees.length > 0 && selectedEmployeeIds.length === employees.length;
        selectAllCheckbox.indeterminate = selectedEmployeeIds.length > 0 && selectedEmployeeIds.length < employees.length;
    }
}

function updateBulkDeleteButton() {
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    const selectedCount = document.getElementById('selected-count');
    
    if (selectedEmployeeIds.length > 0) {
        bulkDeleteBtn.style.display = 'inline-flex';
        selectedCount.textContent = selectedEmployeeIds.length;
    } else {
        bulkDeleteBtn.style.display = 'none';
    }
}

function deleteSelectedEmployees() {
    if (selectedEmployeeIds.length === 0) return;
    
    const message = selectedEmployeeIds.length === 1
        ? 'Are you sure you want to delete this employee?'
        : `Are you sure you want to delete ${selectedEmployeeIds.length} employees?`;
    
    if (!confirm(message)) return;
    
    // Remove employees
    employees = employees.filter(e => !selectedEmployeeIds.includes(e.id));
    
    // Remove from teams
    teams.forEach(team => {
        team.members = team.members.filter(memberId => !selectedEmployeeIds.includes(memberId));
    });
    
    // Remove their holidays
    holidays = holidays.filter(h => !(h.type === 'personal' && selectedEmployeeIds.includes(h.employeeId)));
    
    // Clear selection
    selectedEmployeeIds = [];
    
    saveData();
    renderEmployees();
    renderTeams();
    updateTeamSelectors();
    
    // Update capacity if configured
    if (config.pi.startDate && config.pi.endDate) {
        renderCapacitySummary();
        renderGanttChart();
    }
}

function openAddEmployeeModal() {
    document.getElementById('employee-modal-title').textContent = 'Add Employee';
    document.getElementById('employee-form').reset();
    document.getElementById('employee-id').value = '';
    currentEmployeeTeams = [];
    updateEmployeeTeamsDisplay();
    document.getElementById('employee-modal').classList.add('show');
}

function editEmployee(id) {
    const employee = employees.find(e => e.id === id);
    if (!employee) return;

    document.getElementById('employee-modal-title').textContent = 'Edit Employee';
    document.getElementById('employee-id').value = employee.id;
    document.getElementById('employee-name').value = employee.name;
    document.getElementById('employee-role').value = employee.role;
    document.getElementById('employee-hours').value = employee.hoursPerDay;
    document.getElementById('employee-sp-capacity').value = employee.spCapacity;
    
    // Find all teams this employee is in
    currentEmployeeTeams = teams.filter(t => t.members.includes(id)).map(t => t.id);
    updateEmployeeTeamsDisplay();
    
    document.getElementById('employee-modal').classList.add('show');
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.remove('show');
}

function saveEmployee(event) {
    event.preventDefault();

    const id = document.getElementById('employee-id').value || generateId();
    const name = document.getElementById('employee-name').value;
    const role = document.getElementById('employee-role').value;
    const hoursPerDay = parseFloat(document.getElementById('employee-hours').value);
    const spCapacity = parseInt(document.getElementById('employee-sp-capacity').value);
    
    // For single-team roles, use the first team (or null)
    const allowedRoles = ['Product Owner', 'Product Designer'];
    const teamId = allowedRoles.includes(role) ? null : (currentEmployeeTeams[0] || null);

    const employee = { id, name, role, hoursPerDay, spCapacity, teamId };

    const existingIndex = employees.findIndex(e => e.id === id);
    
    // Get old teams this employee was in
    const oldTeams = teams.filter(t => t.members.includes(id));
    
    if (existingIndex !== -1) {
        // Update existing
        employees[existingIndex] = employee;
    } else {
        // Add new
        employees.push(employee);
    }
    
    // Remove from all old teams
    oldTeams.forEach(team => {
        team.members = team.members.filter(m => m !== id);
    });
    
    // Add to new teams
    currentEmployeeTeams.forEach(teamId => {
        const team = teams.find(t => t.id === teamId);
        if (team && !team.members.includes(id)) {
            team.members.push(id);
        }
    });

    saveData();
    renderEmployees();
    renderTeams();
    
    // Update capacity calculations if PI is configured
    if (config.pi.startDate && config.pi.endDate) {
        renderCapacitySummary();
        renderGanttChart();
    }
    
    closeEmployeeModal();
}

// Individual delete function - replaced with bulk delete
// Keep for backward compatibility if needed
function deleteEmployee(id) {
    // Use bulk delete instead
    selectedEmployeeIds = [id];
    deleteSelectedEmployees();
}

/* OLD DELETE FUNCTION - REPLACED
function deleteEmployee(id) {
    const employee = employees.find(e => e.id === id);
    if (!employee) return;

    // Find all teams this employee is in
    const employeeTeams = teams.filter(t => t.members.includes(id));
    
    if (employeeTeams.length > 0) {
        const teamNames = employeeTeams.map(t => t.name).join('", "');
        const teamWord = employeeTeams.length === 1 ? 'team' : 'teams';
        
        const confirmMessage = `Warning: ${employee.name} is currently assigned to "${teamNames}".\n\nDeleting this employee will also remove them from ${employeeTeams.length === 1 ? 'this team' : 'these teams'}.\n\nAre you sure you want to continue?`;
        
        if (!confirm(confirmMessage)) return;
        
        // Remove from all teams
        employeeTeams.forEach(team => {
            team.members = team.members.filter(m => m !== id);
        });
    } else {
        // Simple confirmation if not in any team
        if (!confirm(`Are you sure you want to delete ${employee.name}?`)) return;
    }

    employees = employees.filter(e => e.id !== id);
    saveData();
    renderEmployees();
    renderTeams();
    
    // Update capacity calculations if PI is configured
    if (config.pi.startDate && config.pi.endDate) {
        renderCapacitySummary();
    }
}
*/

// ============ TEAMS ============

function showTeamDetails(teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    const teamMembers = employees.filter(e => team.members.includes(e.id));
    const totalHours = teamMembers.reduce((sum, e) => sum + e.hoursPerDay, 0);
    const totalSP = teamMembers.reduce((sum, e) => sum + e.spCapacity, 0);
    
    let membersHTML = '';
    if (teamMembers.length > 0) {
        membersHTML = teamMembers.map(m => `
            <div class="team-member-detail">
                <span class="member-name">${m.name} (${m.role})</span>
                <span class="member-capacity">${m.hoursPerDay}h/day · ${m.spCapacity} SP/iteration</span>
            </div>
        `).join('');
    } else {
        membersHTML = '<div class="empty-state-text">No members in this team yet.</div>';
    }
    
    const detailsHTML = `
        <div class="team-details-header">
            <h2>${team.name}</h2>
            ${team.description ? `<p class="team-details-description">${team.description}</p>` : ''}
        </div>
        <div class="team-details-stats">
            <div class="detail-stat-card">
                <div class="detail-stat-label">Total Members</div>
                <div class="detail-stat-value">${teamMembers.length}</div>
            </div>
            <div class="detail-stat-card">
                <div class="detail-stat-label">Total Hours/Day</div>
                <div class="detail-stat-value">${totalHours}h</div>
            </div>
            <div class="detail-stat-card">
                <div class="detail-stat-label">Total SP/Iteration</div>
                <div class="detail-stat-value">${totalSP}</div>
            </div>
        </div>
        <div class="team-details-members">
            <h3>Team Members</h3>
            ${membersHTML}
        </div>
    `;
    
    document.getElementById('team-details-content').innerHTML = detailsHTML;
    document.getElementById('team-details-modal').classList.add('show');
}

function closeTeamDetailsModal() {
    document.getElementById('team-details-modal').classList.remove('show');
}

function showIterationDetails(iterationNumber, teamIdentifier, teamIds) {
    if (!config.pi.startDate || !config.pi.endDate) return;
    
    const startDate = new Date(config.pi.startDate);
    const endDate = new Date(config.pi.endDate);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const numberOfIterations = Math.floor(totalDays / config.pi.iterationDurationWeeks * 7);
    
    // Calculate iteration dates
    const iterationStart = new Date(startDate);
    iterationStart.setDate(iterationStart.getDate() + ((iterationNumber - 1) * config.pi.iterationDurationWeeks * 7));
    const iterationEnd = new Date(iterationStart);
    iterationEnd.setDate(iterationEnd.getDate() + config.pi.iterationDurationWeeks * 7 - 1);
    const adjustedIterationEnd = iterationEnd > endDate ? endDate : iterationEnd;
    
    // Get relevant teams and members
    const relevantTeams = teams.filter(t => teamIds.includes(t.id));
    const members = employees.filter(e => 
        relevantTeams.some(t => t.members.includes(e.id))
    );
    
    // Calculate overall stats
    const workingDays = calculateCombinedIterationWorkingDays(iterationStart, adjustedIterationEnd, teamIds, members);
    const totalHoursPerDay = members.reduce((sum, e) => sum + e.hoursPerDay, 0);
    const totalHours = totalHoursPerDay * workingDays;
    const totalSP = members.reduce((sum, e) => sum + e.spCapacity, 0);
    const offDays = calculateCombinedIterationOffDays(iterationStart, adjustedIterationEnd, teamIds, members);
    
    // Title
    const teamNames = relevantTeams.length > 1 
        ? `Combined Teams (${relevantTeams.map(t => t.name).join(', ')})`
        : relevantTeams[0].name;
    
    document.getElementById('iteration-details-title').textContent = `Iteration ${iterationNumber} - ${teamNames}`;
    
    // Build member details grouped by team
    let membersHTML = '';
    
    // Calculate role-based capacity for all teams combined
    const roleCapacity = {};
    
    // Group members by team
    relevantTeams.forEach(team => {
        const teamMembers = members.filter(m => team.members.includes(m.id));
        
        if (teamMembers.length === 0) return;
        
        // Calculate team summary with adjusted SP
        let teamTotalHours = 0;
        let teamTotalSP = 0;
        let teamTotalWorkingDays = 0;
        
        // Calculate total iteration days for ratio
        const current = new Date(iterationStart);
        let totalIterationDays = 0;
        while (current <= adjustedIterationEnd) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                totalIterationDays++;
            }
            current.setDate(current.getDate() + 1);
        }
        
        teamMembers.forEach(member => {
            const memberWorkingDays = calculateMemberIterationWorkingDays(iterationStart, adjustedIterationEnd, [team.id], member);
            teamTotalWorkingDays += memberWorkingDays;
            teamTotalHours += member.hoursPerDay * memberWorkingDays;
            
            // Adjust SP based on availability ratio
            const availabilityRatio = totalIterationDays > 0 ? memberWorkingDays / totalIterationDays : 0;
            const memberAdjustedSP = member.spCapacity * availabilityRatio;
            teamTotalSP += memberAdjustedSP;
            
            // Accumulate role-based capacity
            if (!roleCapacity[member.role]) {
                roleCapacity[member.role] = {
                    count: 0,
                    hours: 0,
                    sp: 0
                };
            }
            roleCapacity[member.role].count++;
            roleCapacity[member.role].hours += member.hoursPerDay * memberWorkingDays;
            roleCapacity[member.role].sp += memberAdjustedSP;
        });
        
        // Team header with summary
        membersHTML += `
            <div class="iteration-team-group">
                <div class="iteration-team-header">
                    <div class="iteration-team-name">${team.name}</div>
                    <div class="iteration-team-summary">
                        <span class="iteration-team-summary-item">${teamMembers.length} members</span>
                        <span class="iteration-team-summary-item">${formatNumber(teamTotalHours.toFixed(0))}h total</span>
                        <span class="iteration-team-summary-item">${formatNumber(Math.round(teamTotalSP))} SP</span>
                    </div>
                </div>
                <div class="iteration-team-members">
        `;
        
        // Team members
        teamMembers.forEach(member => {
            const memberWorkingDays = calculateMemberIterationWorkingDays(iterationStart, adjustedIterationEnd, [team.id], member);
            const memberHours = member.hoursPerDay * memberWorkingDays;
            const memberOffDays = calculateMemberIterationOffDays(iterationStart, adjustedIterationEnd, [team.id], member);
            
            // Calculate adjusted SP
            const availabilityRatio = totalIterationDays > 0 ? memberWorkingDays / totalIterationDays : 0;
            const adjustedSP = Math.round(member.spCapacity * availabilityRatio);
            
            let offDaysHTML = '';
            if (memberOffDays.length > 0) {
                // Count full and half days
                let fullDays = 0;
                let halfDays = 0;
                const offDaysList = memberOffDays.map(off => {
                    const dayTypeIcon = off.dayType === 'half' ? '🕐' : '🏖️';
                    if (off.dayType === 'half') halfDays++;
                    else fullDays++;
                    return `${dayTypeIcon} ${formatDateShort(off.date)} - ${off.reason}`;
                }).join('<br>');
                
                let offSummary = '';
                if (halfDays > 0 && fullDays > 0) {
                    offSummary = `${memberOffDays.length} off days (${fullDays} full, ${halfDays} half)`;
                } else if (halfDays > 0) {
                    offSummary = `${halfDays} half day${halfDays > 1 ? 's' : ''} off`;
                } else {
                    offSummary = `${fullDays} day${fullDays > 1 ? 's' : ''} off`;
                }
                
                offDaysHTML = `
                    <div class="iteration-member-off-days" title="${offDaysList.replace(/<br>/g, '\n')}">
                        <div class="off-day-header">
                            <span class="off-day-name">${member.name}</span>
                            <span class="off-day-meta">${member.role} • ${member.team}</span>
                        </div>
                        <div class="off-day-summary">🏖️ ${offSummary}</div>
                    </div>
                `;
            }
            
            membersHTML += `
                <div class="iteration-member-item">
                    <div class="iteration-member-info">
                        <div class="iteration-member-name">${member.name}</div>
                        <div class="iteration-member-role">${member.role}</div>
                        ${offDaysHTML}
                    </div>
                    <div class="iteration-member-capacity">
                        <span class="iteration-member-capacity-value">${formatNumber(memberHours.toFixed(0))}h</span>
                        <span class="iteration-member-capacity-details">${memberWorkingDays}d × ${member.hoursPerDay}h</span>
                        <span class="iteration-member-capacity-details">${formatNumber(adjustedSP)} SP</span>
                    </div>
                </div>
            `;
        });
        
        membersHTML += `
                </div>
            </div>
        `;
    });
    
    // Build role capacity HTML
    let roleCapacityHTML = '';
    if (Object.keys(roleCapacity).length > 0) {
        roleCapacityHTML = '<div class="iteration-role-capacity"><h3>Capacity by Role</h3>';
        roleCapacityHTML += '<table class="iteration-role-table">';
        roleCapacityHTML += `
            <thead>
                <tr>
                    <th>Role</th>
                    <th>Members</th>
                    <th>Capacity</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        // Sort roles alphabetically
        const sortedRoles = Object.keys(roleCapacity).sort();
        
        sortedRoles.forEach(role => {
            const data = roleCapacity[role];
            const memberText = data.count === 1 ? '1 member' : `${formatNumber(data.count)} members`;
            const hours = formatNumber(Math.round(data.hours));
            const sp = formatNumber(Math.round(data.sp));
            
            roleCapacityHTML += `
                <tr>
                    <td class="role-name-cell">${role}</td>
                    <td class="role-members-cell">${memberText}</td>
                    <td class="role-capacity-cell">
                        <span class="capacity-hours">${hours}h</span>
                        <span class="capacity-separator">/</span>
                        <span class="capacity-sp">${sp} SP</span>
                    </td>
                </tr>
            `;
        });
        
        roleCapacityHTML += '</tbody></table></div>';
    }
    
    const detailsHTML = `
        <div class="iteration-details-header">
            <div class="iteration-details-dates">${formatDate(iterationStart)} - ${formatDate(adjustedIterationEnd)}</div>
        </div>
        <div class="iteration-details-stats">
            <div class="iteration-stat-card">
                <div class="iteration-stat-card-label">Total Members</div>
                <div class="iteration-stat-card-value">${formatNumber(members.length)}</div>
            </div>
            <div class="iteration-stat-card">
                <div class="iteration-stat-card-label">Working Days</div>
                <div class="iteration-stat-card-value">${formatNumber(workingDays)}</div>
            </div>
            <div class="iteration-stat-card">
                <div class="iteration-stat-card-label">Off Days</div>
                <div class="iteration-stat-card-value">${formatNumber(offDays)}</div>
            </div>
            <div class="iteration-stat-card">
                <div class="iteration-stat-card-label">Total Hours</div>
                <div class="iteration-stat-card-value">${formatNumber(totalHours.toFixed(0))}h</div>
            </div>
            <div class="iteration-stat-card">
                <div class="iteration-stat-card-label">Total SP</div>
                <div class="iteration-stat-card-value">${formatNumber(totalSP)}</div>
            </div>
        </div>
        ${roleCapacityHTML}
        <div class="iteration-details-members">
            <h3>Member Capacity Details</h3>
            ${membersHTML}
        </div>
    `;
    
    document.getElementById('iteration-details-content').innerHTML = detailsHTML;
    document.getElementById('iteration-details-modal').classList.add('show');
}

function calculateMemberIterationWorkingDays(startDate, endDate, teamIds, member) {
    let workingDays = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Check for holidays and get dayType if present
        const publicHoliday = holidays.find(h => {
            return h.type === 'public' && 
                   dateStr >= h.startDate && 
                   dateStr <= h.endDate;
        });
        
        const teamHoliday = holidays.find(h => {
            return h.type === 'team' && 
                   teamIds.includes(h.teamId) &&
                   dateStr >= h.startDate && 
                   dateStr <= h.endDate;
        });
        
        const personalLeave = holidays.find(h => {
            return h.type === 'personal' && 
                   h.employeeId === member.id && 
                   dateStr >= h.startDate && 
                   dateStr <= h.endDate;
        });
        
        if (!isWeekend) {
            // Determine which holiday applies (priority: public > team > personal)
            const applicableHoliday = publicHoliday || teamHoliday || personalLeave;
            
            if (!applicableHoliday) {
                // Full working day
                workingDays += 1;
            } else if (applicableHoliday.dayType === 'half') {
                // Half-day holiday = 0.5 working day
                workingDays += 0.5;
            }
            // else: full-day holiday = 0 working days (don't add anything)
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
}

function calculateMemberIterationOffDays(startDate, endDate, teamIds, member) {
    const offDays = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            current.setDate(current.getDate() + 1);
            continue;
        }
        
        // Check public holidays
        const publicHoliday = holidays.find(h => {
            return h.type === 'public' && 
                   dateStr >= h.startDate && 
                   dateStr <= h.endDate;
        });
        
        if (publicHoliday) {
            const dayTypeLabel = publicHoliday.dayType === 'half' ? ' (Half Day)' : '';
            offDays.push({
                date: new Date(current),
                reason: publicHoliday.name + dayTypeLabel,
                dayType: publicHoliday.dayType || 'full'
            });
        }
        
        // Check team holidays
        const teamHoliday = holidays.find(h => {
            return h.type === 'team' && 
                   teamIds.includes(h.teamId) &&
                   dateStr >= h.startDate && 
                   dateStr <= h.endDate;
        });
        
        if (teamHoliday && !publicHoliday) {
            const team = teams.find(t => t.id === teamHoliday.teamId);
            const dayTypeLabel = teamHoliday.dayType === 'half' ? ' (Half Day)' : '';
            offDays.push({
                date: new Date(current),
                reason: `${teamHoliday.name} (${team ? team.name : 'Team'})` + dayTypeLabel,
                dayType: teamHoliday.dayType || 'full'
            });
        }
        
        // Check personal leave
        const personalLeave = holidays.find(h => {
            return h.type === 'personal' && 
                   h.employeeId === member.id && 
                   dateStr >= h.startDate && 
                   dateStr <= h.endDate;
        });
        
        if (personalLeave && !publicHoliday && !teamHoliday) {
            const dayTypeLabel = personalLeave.dayType === 'half' ? ' (Half Day)' : '';
            offDays.push({
                date: new Date(current),
                reason: personalLeave.name + dayTypeLabel,
                dayType: personalLeave.dayType || 'full'
            });
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    return offDays;
}

function closeIterationDetailsModal() {
    document.getElementById('iteration-details-modal').classList.remove('show');
}

function renderTeams() {
    const container = document.getElementById('teams-container');
    
    if (teams.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <div class="empty-state-text">No teams yet. Click "Add Team" to create your first team.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = teams.map(team => {
        const teamMembers = employees.filter(e => team.members.includes(e.id));
        const totalHours = teamMembers.reduce((sum, e) => sum + e.hoursPerDay, 0);
        const totalSP = teamMembers.reduce((sum, e) => sum + e.spCapacity, 0);

        return `
            <div class="team-card" onclick="showTeamDetails('${team.id}')">
                <div class="team-card-header">
                    <h3 class="team-card-title">${team.name}</h3>
                    <div class="team-card-actions" onclick="event.stopPropagation()">
                        <button class="action-btn" onclick="editTeam('${team.id}')" title="Edit">✏️</button>
                        <button class="action-btn" onclick="deleteTeam('${team.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="team-capacity-stats">
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">Members</span>
                        <span class="capacity-stat-value">${teamMembers.length}</span>
                    </div>
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">Hours/Day</span>
                        <span class="capacity-stat-value">${totalHours}h</span>
                    </div>
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">SP/Iteration</span>
                        <span class="capacity-stat-value">${totalSP}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openAddTeamModal() {
    document.getElementById('team-modal-title').textContent = 'Add Team';
    document.getElementById('team-form').reset();
    document.getElementById('team-id').value = '';
    currentTeamMembers = [];
    updateTeamMembersSelection([]);
    document.getElementById('team-modal').classList.add('show');
}

function editTeam(id) {
    event.stopPropagation(); // Prevent triggering team details modal
    const team = teams.find(t => t.id === id);
    if (!team) return;

    document.getElementById('team-modal-title').textContent = 'Edit Team';
    document.getElementById('team-id').value = team.id;
    document.getElementById('team-name').value = team.name;
    document.getElementById('team-description').value = team.description || '';
    currentTeamMembers = [...team.members];
    updateTeamMembersSelection(currentTeamMembers);
    
    document.getElementById('team-modal').classList.add('show');
}

function updateTeamMembersSelection(selectedMembers = []) {
    const container = document.getElementById('selected-members-list');
    const select = document.getElementById('add-team-member-select');
    
    // Update the dropdown
    if (employees.length === 0) {
        select.innerHTML = '<option value="">No employees available</option>';
        select.disabled = true;
    } else {
        select.innerHTML = '<option value="">Select employee to add...</option>' +
            employees
                .filter(emp => !selectedMembers.includes(emp.id))
                .map(emp => `<option value="${emp.id}">${emp.name} (${emp.role})</option>`)
                .join('');
        select.disabled = false;
    }
    
    // Update the selected members list
    if (selectedMembers.length === 0) {
        container.innerHTML = '<div class="empty-state-text">No members added yet. Select from dropdown above.</div>';
        return;
    }
    
    container.innerHTML = selectedMembers.map(empId => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return '';
        return `
            <div class="selected-member-item">
                <span class="member-info">
                    <strong>${emp.name}</strong>
                    <span class="member-role">(${emp.role})</span>
                </span>
                <button type="button" class="btn-remove-member" onclick="removeTeamMember('${empId}')" title="Remove">✕</button>
            </div>
        `;
    }).join('');
}

// Track current team members during edit
let currentTeamMembers = [];

function addTeamMemberFromSelect() {
    const select = document.getElementById('add-team-member-select');
    const employeeId = select.value;
    
    if (!employeeId) return;
    
    if (!currentTeamMembers.includes(employeeId)) {
        currentTeamMembers.push(employeeId);
        updateTeamMembersSelection(currentTeamMembers);
    }
    
    select.value = '';
}

function removeTeamMember(employeeId) {
    currentTeamMembers = currentTeamMembers.filter(id => id !== employeeId);
    updateTeamMembersSelection(currentTeamMembers);
}

function closeTeamModal() {
    document.getElementById('team-modal').classList.remove('show');
}

function saveTeam(event) {
    event.preventDefault();

    const id = document.getElementById('team-id').value || generateId();
    const name = document.getElementById('team-name').value;
    const description = document.getElementById('team-description').value;
    
    // Get selected members from currentTeamMembers array
    const members = [...currentTeamMembers];

    // Check for members already in other teams (except PO and Product Designer)
    const conflictingMembers = [];
    members.forEach(empId => {
        const emp = employees.find(e => e.id === empId);
        if (emp && emp.teamId && emp.teamId !== id) {
            // Allow Product Owner and Product Designer to be in multiple teams
            const allowedRoles = ['Product Owner', 'Product Designer'];
            if (!allowedRoles.includes(emp.role)) {
                const existingTeam = teams.find(t => t.id === emp.teamId);
                conflictingMembers.push({
                    name: emp.name,
                    role: emp.role,
                    team: existingTeam ? existingTeam.name : 'Unknown Team'
                });
            }
        }
    });

    // Show warning if there are conflicts
    if (conflictingMembers.length > 0) {
        let warningMessage = 'Warning: The following employees are already assigned to other teams:\n\n';
        conflictingMembers.forEach(member => {
            warningMessage += `• ${member.name} (${member.role}) - currently in "${member.team}"\n`;
        });
        warningMessage += '\nOnly Product Owners and Product Designers can be in multiple teams.\n\n';
        warningMessage += 'These employees will be removed from their current teams and added to this team.\n\n';
        warningMessage += 'Do you want to continue?';
        
        if (!confirm(warningMessage)) {
            return;
        }
    }

    const team = { id, name, description, members };

    const existingIndex = teams.findIndex(t => t.id === id);
    if (existingIndex !== -1) {
        // Update existing
        const oldMembers = teams[existingIndex].members;
        teams[existingIndex] = team;
        
        // Update employee teamId references
        oldMembers.forEach(empId => {
            const emp = employees.find(e => e.id === empId);
            if (emp && !members.includes(empId)) {
                // Only clear teamId if this was their team
                if (emp.teamId === id) {
                    emp.teamId = null;
                }
            }
        });
        
        members.forEach(empId => {
            const emp = employees.find(e => e.id === empId);
            if (emp) {
                const allowedRoles = ['Product Owner', 'Product Designer'];
                
                // If employee is already in another team and role is not allowed for multiple teams
                if (emp.teamId && emp.teamId !== id && !allowedRoles.includes(emp.role)) {
                    // Remove from old team
                    const oldTeam = teams.find(t => t.id === emp.teamId);
                    if (oldTeam) {
                        oldTeam.members = oldTeam.members.filter(m => m !== empId);
                    }
                }
                
                // For PO and Designer, we don't change teamId, they can be in multiple teams
                // For others, set the new teamId
                if (!allowedRoles.includes(emp.role)) {
                    emp.teamId = id;
                }
            }
        });
    } else {
        // Add new
        teams.push(team);
        
        // Update employee teamId references
        members.forEach(empId => {
            const emp = employees.find(e => e.id === empId);
            if (emp) {
                const allowedRoles = ['Product Owner', 'Product Designer'];
                
                // If employee is already in another team and role is not allowed for multiple teams
                if (emp.teamId && !allowedRoles.includes(emp.role)) {
                    // Remove from old team
                    const oldTeam = teams.find(t => t.id === emp.teamId);
                    if (oldTeam) {
                        oldTeam.members = oldTeam.members.filter(m => m !== empId);
                    }
                }
                
                // For PO and Designer, we don't change teamId, they can be in multiple teams
                // For others, set the new teamId
                if (!allowedRoles.includes(emp.role)) {
                    emp.teamId = id;
                }
            }
        });
    }

    saveData();
    renderTeams();
    renderEmployees();
    renderTeamFilters();
    
    // Add new team to selected teams filter if it's a new team
    if (existingIndex === -1 && !selectedTeamIds.includes(id)) {
        selectedTeamIds.push(id);
    }
    
    // Update capacity calculations if PI is configured
    if (config.pi.startDate && config.pi.endDate) {
        renderCapacitySummary();
        renderGanttChart();
    }
    
    closeTeamModal();
}

function deleteTeam(id) {
    event.stopPropagation(); // Prevent triggering team details modal
    if (!confirm('Are you sure you want to delete this team? Members will not be deleted, but will be unassigned.')) return;

    const team = teams.find(t => t.id === id);
    if (team) {
        // Remove teamId from all members (except those who can be in multiple teams)
        team.members.forEach(empId => {
            const emp = employees.find(e => e.id === empId);
            if (emp) {
                const allowedRoles = ['Product Owner', 'Product Designer'];
                if (!allowedRoles.includes(emp.role)) {
                    emp.teamId = null;
                }
            }
        });
    }

    teams = teams.filter(t => t.id !== id);
    
    // Remove from selected teams filter
    const index = selectedTeamIds.indexOf(id);
    if (index > -1) {
        selectedTeamIds.splice(index, 1);
    }
    
    saveData();
    renderTeams();
    renderEmployees();
    renderTeamFilters();
    
    // Update capacity calculations if PI is configured
    if (config.pi.startDate && config.pi.endDate) {
        renderCapacitySummary();
        renderGanttChart();
    }
}

// ============ PI CAPACITY ============

function updatePIForm() {
    document.getElementById('pi-name').value = config.pi.name || '';
    document.getElementById('pi-start-date').value = config.pi.startDate || '';
    document.getElementById('pi-end-date').value = config.pi.endDate || '';
    document.getElementById('iteration-duration').value = config.pi.iterationDurationWeeks || 2;
}

// PI Configuration Handlers
function handlePIConfigChange() {
    // When iteration duration changes, recalculate end date
    handleIterationCountChange();
    // Auto-calculate capacity if we have valid PI config
    autoCalculateCapacity();
}

function handleIterationCountChange() {
    const startDateInput = document.getElementById('pi-start-date');
    const endDateInput = document.getElementById('pi-end-date');
    const iterationCountInput = document.getElementById('iteration-count');
    const iterationDurationInput = document.getElementById('iteration-duration');
    
    if (!startDateInput.value) return;
    
    const startDate = new Date(startDateInput.value);
    const iterationCount = parseInt(iterationCountInput.value) || 6;
    const iterationWeeks = parseInt(iterationDurationInput.value) || 2;
    
    // Calculate total days: iterations × weeks × 7 days
    const totalDays = iterationCount * iterationWeeks * 7;
    
    const calculatedEndDate = new Date(startDate);
    calculatedEndDate.setDate(calculatedEndDate.getDate() + totalDays - 1);
    
    endDateInput.value = calculatedEndDate.toISOString().split('T')[0];
    
    // Auto-calculate capacity
    autoCalculateCapacity();
}

function handlePIEndDateChange() {
    // When end date is manually changed, calculate iteration count
    const startDateInput = document.getElementById('pi-start-date');
    const endDateInput = document.getElementById('pi-end-date');
    const iterationCountInput = document.getElementById('iteration-count');
    const iterationDurationInput = document.getElementById('iteration-duration');
    
    if (!startDateInput.value || !endDateInput.value) return;
    
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    // If end date is before start date, set it to start + 1
    if (endDate <= startDate) {
        const newEndDate = new Date(startDate);
        newEndDate.setDate(newEndDate.getDate() + 1);
        endDateInput.value = newEndDate.toISOString().split('T')[0];
        return;
    }
    
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const iterationWeeks = parseInt(iterationDurationInput.value) || 2;
    const iterationDays = iterationWeeks * 7;
    
    const calculatedIterationCount = Math.ceil(totalDays / iterationDays);
    iterationCountInput.value = calculatedIterationCount;
    
    // Auto-calculate capacity
    autoCalculateCapacity();
}

function handlePIStartDateChange() {
    const startDateInput = document.getElementById('pi-start-date');
    const endDateInput = document.getElementById('pi-end-date');
    
    if (!startDateInput.value) return;
    
    const startDate = new Date(startDateInput.value);
    
    // If end date exists and is before start date, adjust it
    if (endDateInput.value) {
        const endDate = new Date(endDateInput.value);
        if (endDate <= startDate) {
            const newEndDate = new Date(startDate);
            newEndDate.setDate(newEndDate.getDate() + 1);
            endDateInput.value = newEndDate.toISOString().split('T')[0];
        }
    } else {
        // If no end date, calculate it based on iteration count
        handleIterationCountChange();
    }
    
    // Auto-calculate capacity
    autoCalculateCapacity();
}

function autoCalculateCapacity() {
    const startDate = document.getElementById('pi-start-date').value;
    const endDate = document.getElementById('pi-end-date').value;
    
    // Only auto-calculate if we have valid dates
    if (startDate && endDate) {
        calculatePICapacity();
    }
}

function calculatePICapacity() {
    // Get PI configuration
    config.pi.name = document.getElementById('pi-name').value;
    config.pi.startDate = document.getElementById('pi-start-date').value;
    config.pi.endDate = document.getElementById('pi-end-date').value;
    // Convert weeks to days
    const weeks = parseInt(document.getElementById('iteration-duration').value);
    config.pi.iterationDurationWeeks = weeks;

    if (!config.pi.startDate || !config.pi.endDate) {
        alert('Please enter start and end dates.');
        return;
    }

    saveData();
    renderCapacitySummary();
}

function renderCapacitySummary() {
    const summaryContainer = document.getElementById('capacity-summary');
    const detailsContainer = document.getElementById('team-capacity-details');

    if (!config.pi.startDate || !config.pi.endDate) {
        summaryContainer.innerHTML = '<div class="empty-state-text">Please configure PI dates to calculate capacity.</div>';
        detailsContainer.innerHTML = '';
        return;
    }

    // Calculate PI duration
    const startDate = new Date(config.pi.startDate);
    const endDate = new Date(config.pi.endDate);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculate working days
    const workingDays = calculateWorkingDays(startDate, endDate);
    
    // Calculate number of iterations correctly
    const iterationDays = config.pi.iterationDurationWeeks * 7;
    const numberOfIterations = Math.ceil(totalDays / iterationDays);
    
    // Calculate total capacity
    const totalEmployees = employees.length;
    const totalTeams = teams.length;
    const totalHoursPerDay = employees.reduce((sum, e) => sum + e.hoursPerDay, 0);
    const totalSPPerIteration = employees.reduce((sum, e) => sum + e.spCapacity, 0);
    const totalHours = totalHoursPerDay * workingDays;
    const totalSP = totalSPPerIteration * numberOfIterations;

    // Render summary
    summaryContainer.innerHTML = `
        <div class="summary-card">
            <div class="summary-card-title">Total Duration</div>
            <div class="summary-card-value">${totalDays}</div>
            <div class="summary-card-subtitle">days</div>
        </div>
        <div class="summary-card">
            <div class="summary-card-title">Working Days</div>
            <div class="summary-card-value">${workingDays}</div>
            <div class="summary-card-subtitle">excluding weekends & holidays</div>
        </div>
        <div class="summary-card">
            <div class="summary-card-title"># of Iterations</div>
            <div class="summary-card-value">${numberOfIterations}</div>
            <div class="summary-card-subtitle">${config.pi.iterationDurationWeeks} week${config.pi.iterationDurationWeeks > 1 ? 's' : ''} each</div>
        </div>
        <div class="summary-card">
            <div class="summary-card-title">Total Teams</div>
            <div class="summary-card-value">${totalTeams}</div>
            <div class="summary-card-subtitle">teams</div>
        </div>
        <div class="summary-card">
            <div class="summary-card-title">Total Employees</div>
            <div class="summary-card-value">${totalEmployees}</div>
            <div class="summary-card-subtitle">employees</div>
        </div>
        <div class="summary-card">
            <div class="summary-card-title">Total Hours</div>
            <div class="summary-card-value">${formatNumber(totalHours.toFixed(0))}</div>
            <div class="summary-card-subtitle">person-hours</div>
        </div>
        <div class="summary-card">
            <div class="summary-card-title">Total Capacity</div>
            <div class="summary-card-value">${formatNumber(totalSP)}</div>
            <div class="summary-card-subtitle">story points</div>
        </div>
    `;

    // Render team details
    if (teams.length === 0) {
        detailsContainer.innerHTML = '<div class="empty-state-text">No teams configured.</div>';
        return;
    }

    detailsContainer.innerHTML = teams.map(team => {
        const teamMembers = employees.filter(e => team.members.includes(e.id));
        const teamHoursPerDay = teamMembers.reduce((sum, e) => sum + e.hoursPerDay, 0);
        const teamSPPerIteration = teamMembers.reduce((sum, e) => sum + e.spCapacity, 0);
        
        // Calculate team-specific working days (considering team holidays)
        const teamWorkingDays = calculateTeamWorkingDays(startDate, endDate, team.id);
        const teamTotalHours = teamHoursPerDay * teamWorkingDays;
        const teamTotalSP = teamSPPerIteration * numberOfIterations;
        
        // Calculate off days for this team
        const teamOffDays = calculateTeamOffDays(startDate, endDate, team.id);

        return `
            <div class="team-capacity-card">
                <div class="team-capacity-header">
                    <div class="team-capacity-name">${team.name}</div>
                </div>
                <div class="team-capacity-stats">
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">Members</span>
                        <span class="capacity-stat-value">${teamMembers.length}</span>
                    </div>
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">Working Days</span>
                        <span class="capacity-stat-value">${teamWorkingDays}</span>
                    </div>
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">Off Days</span>
                        <span class="capacity-stat-value">${teamOffDays}</span>
                    </div>
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">Hours/Day</span>
                        <span class="capacity-stat-value">${teamHoursPerDay}h</span>
                    </div>
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">Total Hours</span>
                        <span class="capacity-stat-value">${formatNumber(teamTotalHours.toFixed(0))}h</span>
                    </div>
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">SP/Iteration</span>
                        <span class="capacity-stat-value">${formatNumber(teamSPPerIteration)}</span>
                    </div>
                    <div class="capacity-stat">
                        <span class="capacity-stat-label">Total SP</span>
                        <span class="capacity-stat-value">${formatNumber(teamTotalSP)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function calculateTeamWorkingDays(startDate, endDate, teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return 0;
    
    const teamMembers = employees.filter(e => team.members.includes(e.id));
    let totalPersonDays = 0;
    
    // Calculate person-days considering individual personal leaves
    teamMembers.forEach(member => {
        let memberWorkingDays = 0;
        const current = new Date(startDate);
        
        while (current <= endDate) {
            const dayOfWeek = current.getDay();
            const dateStr = current.toISOString().split('T')[0];
            
            // Check if it's a weekend
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // Check if it's a public or team holiday
            const isHoliday = holidays.some(h => {
                if (dateStr >= h.startDate && dateStr <= h.endDate) {
                    if (h.type === 'public') return true;
                    if (h.type === 'team' && h.teamId === teamId) return true;
                }
                return false;
            });
            
            // Check if this member has personal leave
            const hasPersonalLeave = holidays.some(h => {
                return h.type === 'personal' && 
                       h.employeeId === member.id && 
                       dateStr >= h.startDate && 
                       dateStr <= h.endDate;
            });
            
            if (!isWeekend && !isHoliday && !hasPersonalLeave) {
                memberWorkingDays++;
            }
            
            current.setDate(current.getDate() + 1);
        }
        
        totalPersonDays += memberWorkingDays;
    });
    
    // Return average working days per person
    return teamMembers.length > 0 ? Math.round(totalPersonDays / teamMembers.length) : 0;
}

function calculateTeamOffDays(startDate, endDate, teamId) {
    let count = 0;
    const current = new Date(startDate);
    const team = teams.find(t => t.id === teamId);
    if (!team) return 0;
    
    const teamMembers = employees.filter(e => team.members.includes(e.id));
    
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            current.setDate(current.getDate() + 1);
            continue;
        }
        
        // Count holidays for this team
        const isHoliday = holidays.some(h => {
            if (dateStr >= h.startDate && dateStr <= h.endDate) {
                if (h.type === 'public') return true;
                if (h.type === 'team' && h.teamId === teamId) return true;
            }
            return false;
        });
        
        if (isHoliday) {
            count++;
        }
        
        // Count personal leaves for team members
        teamMembers.forEach(member => {
            const hasPersonalLeave = holidays.some(h => {
                return h.type === 'personal' && 
                       h.employeeId === member.id && 
                       dateStr >= h.startDate && 
                       dateStr <= h.endDate;
            });
            if (hasPersonalLeave) {
                count++;
            }
        });
        
        current.setDate(current.getDate() + 1);
    }
    
    return count;
}

// ============ HOLIDAYS ============

function manageEmployeeOffDays(employeeId) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    // Open holiday modal with employee pre-selected
    document.getElementById('holiday-form').reset();
    document.getElementById('holiday-id').value = '';
    document.getElementById('holiday-type').value = 'personal';
    
    // Update employee selector
    const holidayEmployeeSelect = document.getElementById('holiday-employee');
    if (holidayEmployeeSelect) {
        holidayEmployeeSelect.innerHTML = '<option value="">Select Employee</option>' +
            employees.map(e => `<option value="${e.id}" ${e.id === employeeId ? 'selected' : ''}>${e.name}</option>`).join('');
    }
    
    toggleHolidayFields();
    document.getElementById('holiday-modal').classList.add('show');
}

function renderHolidays() {
    const container = document.getElementById('holidays-list');
    
    if (holidays.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏖️</div>
                <div class="empty-state-text">No holidays configured yet.</div>
            </div>
        `;
        return;
    }

    // Group individual day entries by name + type + target
    const aggregatedHolidays = {};
    
    holidays.forEach(holiday => {
        // Create unique key for grouping
        const targetId = holiday.type === 'team' ? holiday.teamId : 
                        holiday.type === 'personal' ? holiday.employeeId : 'public';
        const key = `${holiday.name}|${holiday.type}|${targetId}`;
        
        if (!aggregatedHolidays[key]) {
            aggregatedHolidays[key] = {
                name: holiday.name,
                type: holiday.type,
                teamId: holiday.teamId,
                employeeId: holiday.employeeId,
                days: []
            };
        }
        
        aggregatedHolidays[key].days.push({
            date: holiday.startDate,
            dayType: holiday.dayType || 'full',
            id: holiday.id
        });
    });

    // Convert to array and sort days within each holiday
    const holidayList = Object.values(aggregatedHolidays).map(h => {
        h.days.sort((a, b) => a.date.localeCompare(b.date));
        return h;
    });

    // Group holidays by month (based on first day)
    const groupedByMonth = {};
    holidayList.forEach(holiday => {
        const date = new Date(holiday.days[0].date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        
        if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = {
                name: monthName,
                holidays: []
            };
        }
        groupedByMonth[monthKey].holidays.push(holiday);
    });

    // Sort months
    const sortedMonths = Object.keys(groupedByMonth).sort();

    container.innerHTML = sortedMonths.map(monthKey => {
        const group = groupedByMonth[monthKey];
        
        const holidayItems = group.holidays.map(holiday => {
            let target = '';
            let icon = '';
            
            if (holiday.type === 'public') {
                target = 'All employees';
                icon = '🌍';
            } else if (holiday.type === 'team') {
                const team = teams.find(t => t.id === holiday.teamId);
                target = team ? team.name : 'Unknown team';
                icon = '👥';
            } else if (holiday.type === 'personal') {
                const employee = employees.find(e => e.id === holiday.employeeId);
                target = employee ? employee.name : 'Unknown employee';
                icon = '👤';
            }

            // Calculate total days
            let totalDays = 0;
            let fullDays = 0;
            let halfDays = 0;
            
            holiday.days.forEach(d => {
                if (d.dayType === 'half') {
                    totalDays += 0.5;
                    halfDays++;
                } else {
                    totalDays += 1;
                    fullDays++;
                }
            });

            // Format date range
            const firstDate = holiday.days[0].date;
            const lastDate = holiday.days[holiday.days.length - 1].date;
            const dateDisplay = firstDate === lastDate 
                ? formatDate(firstDate)
                : `${formatDate(firstDate)} - ${formatDate(lastDate)}`;

            // Create days summary
            let daysSummary = '';
            if (halfDays > 0 && fullDays > 0) {
                daysSummary = `${totalDays} days (${fullDays} full + ${halfDays} half)`;
            } else if (halfDays > 0) {
                daysSummary = `${totalDays} days (${halfDays} half)`;
            } else {
                daysSummary = `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
            }

            // Get all IDs for deletion
            const holidayIds = holiday.days.map(d => d.id).join(',');

            return `
                <div class="holiday-card">
                    <div class="holiday-card-header">
                        <span class="holiday-icon">${icon}</span>
                        <span class="holiday-type-badge ${holiday.type}">${holiday.type}</span>
                    </div>
                    <div class="holiday-card-body">
                        <div class="holiday-card-name">${holiday.name}</div>
                        <div class="holiday-card-date">${dateDisplay}</div>
                        <div class="holiday-card-target">${target}</div>
                        <div class="holiday-card-days">${daysSummary}</div>
                    </div>
                    <button class="holiday-card-delete" onclick="deleteHolidayGroup('${holidayIds}')" title="Delete">
                        <span>🗑️</span>
                    </button>
                </div>
            `;
        }).join('');

        return `
            <div class="holiday-month-group">
                <h3 class="holiday-month-title">${group.name}</h3>
                <div class="holiday-cards-grid">
                    ${holidayItems}
                </div>
            </div>
        `;
    }).join('');
}

// Track holiday days breakdown
let holidayDaysBreakdown = [];

function openAddHolidayModal() {
    document.getElementById('holiday-form').reset();
    document.getElementById('holiday-id').value = '';
    holidayDaysBreakdown = [];
    
    // Update employee selector
    const holidayEmployeeSelect = document.getElementById('holiday-employee');
    if (holidayEmployeeSelect) {
        holidayEmployeeSelect.innerHTML = '<option value="">Select Employee</option>' +
            employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    }
    
    // Hide breakdown initially
    document.getElementById('holiday-days-breakdown').style.display = 'none';
    
    toggleHolidayFields();
    document.getElementById('holiday-modal').classList.add('show');
}

// Handle holiday start date change
function handleHolidayStartDateChange() {
    const startDateInput = document.getElementById('holiday-start-date');
    const endDateInput = document.getElementById('holiday-end-date');
    
    const startDate = new Date(startDateInput.value);
    const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
    
    // If end date exists and is before or equal to start date, set it to start + 1 day
    if (endDate && endDate <= startDate) {
        const newEndDate = new Date(startDate);
        newEndDate.setDate(newEndDate.getDate() + 1);
        endDateInput.value = newEndDate.toISOString().split('T')[0];
    }
    
    // Update the days breakdown
    updateHolidayDays();
}

// Update holiday days breakdown when dates change
function updateHolidayDays() {
    const startDate = document.getElementById('holiday-start-date').value;
    const endDate = document.getElementById('holiday-end-date').value;
    const excludeWeekends = document.getElementById('holiday-exclude-weekends').checked;
    
    if (!startDate || !endDate) {
        document.getElementById('holiday-days-breakdown').style.display = 'none';
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
        document.getElementById('holiday-days-breakdown').style.display = 'none';
        return;
    }
    
    // Generate days list
    holidayDaysBreakdown = [];
    const current = new Date(start);
    
    while (current <= end) {
        const dayOfWeek = current.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Skip weekends if exclude is checked
        if (!excludeWeekends || !isWeekend) {
            holidayDaysBreakdown.push({
                date: new Date(current),
                isWeekend: isWeekend,
                type: 'full' // default to full day
            });
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    if (holidayDaysBreakdown.length > 0) {
        renderHolidayDaysBreakdown();
        document.getElementById('holiday-days-breakdown').style.display = 'block';
    } else {
        document.getElementById('holiday-days-breakdown').style.display = 'none';
    }
}

function renderHolidayDaysBreakdown() {
    const container = document.getElementById('holiday-days-list');
    
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const daysHtml = holidayDaysBreakdown.map((day, index) => {
        const dayOfWeek = day.date.getDay();
        const weekdayName = weekdayNames[dayOfWeek];
        const dateStr = formatDate(day.date);
        const weekendClass = day.isWeekend ? 'holiday-day-weekend' : '';
        
        return `
            <div class="holiday-day-item">
                <div class="holiday-day-info">
                    <div class="holiday-day-date">${dateStr}</div>
                    <div class="holiday-day-weekday ${weekendClass}">${weekdayName}</div>
                </div>
                <div class="holiday-day-type">
                    <button type="button" 
                            class="holiday-day-type-btn ${day.type === 'full' ? 'active' : ''}" 
                            onclick="setHolidayDayType(${index}, 'full')">
                        Full Day
                    </button>
                    <button type="button" 
                            class="holiday-day-type-btn ${day.type === 'half' ? 'active' : ''}" 
                            onclick="setHolidayDayType(${index}, 'half')">
                        Half Day
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Calculate summary
    let fullDays = holidayDaysBreakdown.filter(d => d.type === 'full').length;
    let halfDays = holidayDaysBreakdown.filter(d => d.type === 'half').length;
    let totalDays = fullDays + (halfDays * 0.5);
    
    const summaryHtml = `
        <div class="holiday-days-summary">
            📊 Total: ${totalDays} day${totalDays !== 1 ? 's' : ''} 
            ${fullDays > 0 ? `(${fullDays} full` : ''}
            ${fullDays > 0 && halfDays > 0 ? ' + ' : ''}
            ${halfDays > 0 ? `${halfDays} half)` : fullDays > 0 ? ')' : ''}
        </div>
    `;
    
    container.innerHTML = daysHtml + summaryHtml;
}

function setHolidayDayType(index, type) {
    holidayDaysBreakdown[index].type = type;
    renderHolidayDaysBreakdown();
}

function toggleHolidayFields() {
    const type = document.getElementById('holiday-type').value;
    const teamsGroup = document.getElementById('holiday-teams-group');
    const employeeGroup = document.getElementById('holiday-employee-group');

    teamsGroup.style.display = type === 'team' ? 'flex' : 'none';
    employeeGroup.style.display = type === 'personal' ? 'flex' : 'none';
    
    // Update teams checkboxes when shown
    if (type === 'team') {
        updateHolidayTeamsCheckboxes();
    }
}

function updateHolidayTeamsCheckboxes() {
    const container = document.getElementById('holiday-teams-checkboxes');
    
    if (teams.length === 0) {
        container.innerHTML = '<div class="empty-state-text">No teams available.</div>';
        return;
    }
    
    container.innerHTML = teams.map(team => `
        <label>
            <input type="checkbox" value="${team.id}" class="holiday-team-checkbox">
            ${team.name}
        </label>
    `).join('');
}

function closeHolidayModal() {
    document.getElementById('holiday-modal').classList.remove('show');
}

function saveHoliday(event) {
    event.preventDefault();

    const type = document.getElementById('holiday-type').value;
    const name = document.getElementById('holiday-name').value;
    const startDate = document.getElementById('holiday-start-date').value;
    const endDate = document.getElementById('holiday-end-date').value;
    const excludeWeekends = document.getElementById('holiday-exclude-weekends').checked;

    // If we have breakdown days, create individual entries for each day
    if (holidayDaysBreakdown.length > 0) {
        if (type === 'team') {
            // Get selected teams
            const checkboxes = document.querySelectorAll('.holiday-team-checkbox:checked');
            const selectedTeams = Array.from(checkboxes).map(cb => cb.value);
            
            if (selectedTeams.length === 0) {
                alert('Please select at least one team.');
                return;
            }
            
            // Create entries for each team and each day
            selectedTeams.forEach(teamId => {
                holidayDaysBreakdown.forEach(day => {
                    const holiday = {
                        id: generateId(),
                        type,
                        name,
                        startDate: day.date.toISOString().split('T')[0],
                        endDate: day.date.toISOString().split('T')[0],
                        excludeWeekends,
                        teamId,
                        dayType: day.type // 'full' or 'half'
                    };
                    holidays.push(holiday);
                });
            });
        } else if (type === 'personal') {
            const employeeId = document.getElementById('holiday-employee').value;
            
            if (!employeeId) {
                alert('Please select an employee.');
                return;
            }
            
            // Create entries for each day
            holidayDaysBreakdown.forEach(day => {
                const holiday = {
                    id: generateId(),
                    type,
                    name,
                    startDate: day.date.toISOString().split('T')[0],
                    endDate: day.date.toISOString().split('T')[0],
                    excludeWeekends,
                    employeeId,
                    dayType: day.type // 'full' or 'half'
                };
                holidays.push(holiday);
            });
        } else {
            // Public holiday - create entries for each day
            holidayDaysBreakdown.forEach(day => {
                const holiday = {
                    id: generateId(),
                    type,
                    name,
                    startDate: day.date.toISOString().split('T')[0],
                    endDate: day.date.toISOString().split('T')[0],
                    excludeWeekends,
                    dayType: day.type // 'full' or 'half'
                };
                holidays.push(holiday);
            });
        }
    } else {
        // Fallback: no breakdown, single entry (old behavior)
        if (type === 'team') {
            const checkboxes = document.querySelectorAll('.holiday-team-checkbox:checked');
            const selectedTeams = Array.from(checkboxes).map(cb => cb.value);
            
            if (selectedTeams.length === 0) {
                alert('Please select at least one team.');
                return;
            }
            
            selectedTeams.forEach(teamId => {
                const holiday = {
                    id: generateId(),
                    type,
                    name,
                    startDate,
                    endDate,
                    excludeWeekends,
                    teamId,
                    dayType: 'full'
                };
                holidays.push(holiday);
            });
        } else if (type === 'personal') {
            const employeeId = document.getElementById('holiday-employee').value;
            
            if (!employeeId) {
                alert('Please select an employee.');
                return;
            }
            
            const holiday = {
                id: generateId(),
                type,
                name,
                startDate,
                endDate,
                excludeWeekends,
                employeeId,
                dayType: 'full'
            };
            holidays.push(holiday);
        } else {
            const holiday = {
                id: generateId(),
                type,
                name,
                startDate,
                endDate,
                excludeWeekends,
                dayType: 'full'
            };
            holidays.push(holiday);
        }
    }

    saveData();
    renderHolidays();
    renderGanttChart();
    
    // Update capacity calculations if PI is configured
    if (config.pi.startDate && config.pi.endDate) {
        renderCapacitySummary();
    }
    
    closeHolidayModal();
}

function deleteHoliday(id) {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    
    // Filter out the holiday
    holidays = holidays.filter(h => h.id !== id);
    
    // Sync and save
    syncBackToOrganization();
    saveData();
    syncLegacyData(); // Re-sync to refresh holidays array
    
    // Re-render
    renderHolidays();
    renderGanttChart();
    
    // Update capacity calculations if PI is configured
    if (config.pi.startDate && config.pi.endDate) {
        renderCapacitySummary();
    }
}

function deleteHolidayGroup(ids) {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    
    // Parse comma-separated IDs
    const idList = ids.split(',');
    
    // Filter out all holidays in this group
    holidays = holidays.filter(h => !idList.includes(h.id));
    
    // Sync and save
    syncBackToOrganization();
    saveData();
    syncLegacyData(); // Re-sync to refresh holidays array
    
    // Re-render
    renderHolidays();
    renderGanttChart();
    
    // Update capacity calculations if PI is configured
    if (config.pi.startDate && config.pi.endDate) {
        renderCapacitySummary();
    }
}

// ============ GANTT CHART ============

// Track selected teams for filtering
let selectedTeamIds = [];

function renderTeamFilters() {
    const container = document.getElementById('team-filter-options');
    
    if (teams.length === 0) {
        container.innerHTML = '<div class="empty-state-text" style="padding: 12px;">No teams available.</div>';
        return;
    }
    
    // Initialize all teams as selected if none are selected
    if (selectedTeamIds.length === 0) {
        selectedTeamIds = teams.map(t => t.id);
    }
    
    container.innerHTML = teams.map(team => `
        <div class="team-filter-option" onclick="toggleTeamFilter('${team.id}', event)">
            <input type="checkbox" 
                   id="team-${team.id}"
                   value="${team.id}" 
                   ${selectedTeamIds.includes(team.id) ? 'checked' : ''}>
            <label for="team-${team.id}">${team.name}</label>
        </div>
    `).join('');
    
    updateTeamFilterDisplay();
    updateSelectAllCheckbox();
}

function toggleTeamFilterDropdown() {
    const dropdown = document.getElementById('team-filter-dropdown');
    const display = document.getElementById('team-filter-display');
    
    dropdown.classList.toggle('show');
    display.classList.toggle('active');
}

function toggleTeamFilter(teamId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const checkbox = document.getElementById(`team-${teamId}`);
    
    // Toggle checkbox state
    const index = selectedTeamIds.indexOf(teamId);
    if (index === -1) {
        // Not selected, add it
        selectedTeamIds.push(teamId);
        checkbox.checked = true;
    } else {
        // Already selected, try to remove it
        if (selectedTeamIds.length > 1) {
            selectedTeamIds.splice(index, 1);
            checkbox.checked = false;
        } else {
            // Can't remove the last one
            alert('At least one team must be selected.');
            checkbox.checked = true;
        }
    }
    
    updateTeamFilterDisplay();
    updateSelectAllCheckbox();
    renderGanttChart();
}

function selectAllTeams(event) {
    if (event) {
        event.stopPropagation();
    }
    
    const selectAllCheckbox = document.getElementById('select-all-teams');
    
    // Toggle between all and first team only
    if (selectedTeamIds.length === teams.length) {
        // All selected, deselect all except first
        selectedTeamIds = teams.length > 0 ? [teams[0].id] : [];
        selectAllCheckbox.checked = false;
    } else {
        // Not all selected, select all
        selectedTeamIds = teams.map(t => t.id);
        selectAllCheckbox.checked = true;
    }
    
    renderTeamFilters();
    renderGanttChart();
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-teams');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = selectedTeamIds.length === teams.length;
    }
}

function updateTeamFilterDisplay() {
    const displayText = document.getElementById('team-filter-text');
    
    if (selectedTeamIds.length === 0) {
        displayText.textContent = 'Select teams...';
    } else if (selectedTeamIds.length === teams.length) {
        displayText.textContent = 'All Teams';
    } else if (selectedTeamIds.length === 1) {
        const team = teams.find(t => t.id === selectedTeamIds[0]);
        displayText.textContent = team ? team.name : 'Select teams...';
    } else {
        displayText.textContent = `${selectedTeamIds.length} Teams Selected`;
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('team-filter-dropdown');
    const display = document.getElementById('team-filter-display');
    
    if (dropdown && display && 
        !dropdown.contains(event.target) && 
        !display.contains(event.target)) {
        dropdown.classList.remove('show');
        display.classList.remove('active');
    }
});

function renderGanttChart() {
    const container = document.getElementById('gantt-chart');

    if (!config.pi.startDate || !config.pi.endDate || !config.pi.iterationDurationWeeks * 7) {
        container.innerHTML = '<div class="empty-state-text">Please configure PI dates and calculate capacity to view timeline.</div>';
        return;
    }

    const startDate = new Date(config.pi.startDate);
    const endDate = new Date(config.pi.endDate);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const iterationDays = config.pi.iterationDurationWeeks * 7;
    const numberOfIterations = Math.ceil(totalDays / iterationDays);
    
    if (numberOfIterations === 0) {
        container.innerHTML = '<div class="empty-state-text">PI duration is too short for iteration planning.</div>';
        return;
    }

    // Generate iterations - only within PI date range
    const iterations = [];
    for (let i = 0; i < numberOfIterations; i++) {
        const iterationStart = new Date(startDate);
        iterationStart.setDate(iterationStart.getDate() + (i * iterationDays));
        
        // Stop if iteration start is beyond PI end date
        if (iterationStart > endDate) break;
        
        const iterationEnd = new Date(iterationStart);
        iterationEnd.setDate(iterationEnd.getDate() + iterationDays - 1);
        
        // Cap iteration end at PI end date
        if (iterationEnd > endDate) {
            iterationEnd.setTime(endDate.getTime());
        }
        
        iterations.push({
            number: i + 1,
            startDate: iterationStart,
            endDate: iterationEnd
        });
    }

    // Filter teams based on selection
    const filteredTeams = teams.filter(t => selectedTeamIds.includes(t.id));
    
    if (filteredTeams.length === 0) {
        container.innerHTML = '<div class="empty-state-text">Please select at least one team.</div>';
        return;
    }

    let html = '<div class="iteration-timeline">';
    
    // If multiple teams selected, show combined view
    if (filteredTeams.length > 1) {
        const combinedTeamIds = filteredTeams.map(t => t.id);
        const combinedMembers = employees.filter(e => 
            filteredTeams.some(t => t.members.includes(e.id))
        );
        
        html += `<div class="team-iteration-section">`;
        html += `<h3 class="team-iteration-title">Combined Teams (${filteredTeams.map(t => t.name).join(', ')})</h3>`;
        html += `<div class="iteration-cards-container">`;
        
        iterations.forEach(iteration => {
            html += renderIterationCard(iteration, combinedTeamIds, combinedMembers, 'combined');
        });
        
        html += '</div></div>';
    } else {
        // Single team view
        const team = filteredTeams[0];
        const teamMembers = employees.filter(e => team.members.includes(e.id));
        
        html += `<div class="team-iteration-section">`;
        html += `<h3 class="team-iteration-title">${team.name}</h3>`;
        html += `<div class="iteration-cards-container">`;
        
        iterations.forEach(iteration => {
            html += renderIterationCard(iteration, [team.id], teamMembers, team.id);
        });
        
        html += '</div></div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function renderIterationCard(iteration, teamIds, members, teamIdentifier) {
    // Calculate capacity for this iteration
    const workingDays = calculateCombinedIterationWorkingDays(iteration.startDate, iteration.endDate, teamIds, members);
    const totalHoursPerDay = members.reduce((sum, e) => sum + e.hoursPerDay, 0);
    const totalHours = totalHoursPerDay * workingDays;
    
    // Calculate adjusted SP based on individual member availability
    const totalSP = calculateIterationSPCapacity(iteration.startDate, iteration.endDate, teamIds, members);
    
    const offDays = calculateCombinedIterationOffDays(iteration.startDate, iteration.endDate, teamIds, members);
    
    return `
        <div class="iteration-card" onclick="showIterationDetails(${iteration.number}, '${teamIdentifier}', ${JSON.stringify(teamIds).replace(/"/g, '&quot;')})">
            <div class="iteration-card-header">
                <span class="iteration-number">Iteration ${iteration.number}</span>
                <span class="iteration-dates">${formatDateShort(iteration.startDate)} - ${formatDateShort(iteration.endDate)}</span>
            </div>
            <div class="iteration-card-stats">
                <div class="iteration-stat">
                    <span class="iteration-stat-label">Working</span>
                    <span class="iteration-stat-value">${workingDays}d</span>
                </div>
                <div class="iteration-stat">
                    <span class="iteration-stat-label">Off</span>
                    <span class="iteration-stat-value">${offDays}d</span>
                </div>
                <div class="iteration-stat">
                    <span class="iteration-stat-label">Hours</span>
                    <span class="iteration-stat-value">${formatNumber(totalHours.toFixed(0))}h</span>
                </div>
                <div class="iteration-stat">
                    <span class="iteration-stat-label">SP</span>
                    <span class="iteration-stat-value">${formatNumber(Math.round(totalSP))}</span>
                </div>
            </div>
        </div>
    `;
}

function calculateIterationSPCapacity(startDate, endDate, teamIds, members) {
    // Calculate SP capacity adjusted for off days
    let totalAdjustedSP = 0;
    
    // Calculate total working days in iteration
    const current = new Date(startDate);
    let totalIterationDays = 0;
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            totalIterationDays++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    if (totalIterationDays === 0) return 0;
    
    members.forEach(member => {
        const memberWorkingDays = calculateMemberIterationWorkingDays(startDate, endDate, teamIds, member);
        const availabilityRatio = memberWorkingDays / totalIterationDays;
        const adjustedSP = member.spCapacity * availabilityRatio;
        totalAdjustedSP += adjustedSP;
    });
    
    return totalAdjustedSP;
}

function calculateCombinedIterationWorkingDays(startDate, endDate, teamIds, members) {
    let totalPersonDays = 0;
    
    members.forEach(member => {
        let memberWorkingDays = 0;
        const current = new Date(startDate);
        
        while (current <= endDate) {
            const dayOfWeek = current.getDay();
            const dateStr = current.toISOString().split('T')[0];
            
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            const isHoliday = holidays.some(h => {
                if (dateStr >= h.startDate && dateStr <= h.endDate) {
                    if (h.type === 'public') return true;
                    if (h.type === 'team' && teamIds.includes(h.teamId)) return true;
                }
                return false;
            });
            
            const hasPersonalLeave = holidays.some(h => {
                return h.type === 'personal' && 
                       h.employeeId === member.id && 
                       dateStr >= h.startDate && 
                       dateStr <= h.endDate;
            });
            
            if (!isWeekend && !isHoliday && !hasPersonalLeave) {
                memberWorkingDays++;
            }
            
            current.setDate(current.getDate() + 1);
        }
        
        totalPersonDays += memberWorkingDays;
    });
    
    return members.length > 0 ? Math.round(totalPersonDays / members.length) : 0;
}

function calculateCombinedIterationOffDays(startDate, endDate, teamIds, members) {
    let totalOffDays = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            current.setDate(current.getDate() + 1);
            continue;
        }
        
        const isHoliday = holidays.some(h => {
            if (dateStr >= h.startDate && dateStr <= h.endDate) {
                if (h.type === 'public') return true;
                if (h.type === 'team' && teamIds.includes(h.teamId)) return true;
            }
            return false;
        });
        
        if (isHoliday) {
            totalOffDays++;
        }
        
        members.forEach(member => {
            const hasPersonalLeave = holidays.some(h => {
                return h.type === 'personal' && 
                       h.employeeId === member.id && 
                       dateStr >= h.startDate && 
                       dateStr <= h.endDate;
            });
            if (hasPersonalLeave) {
                totalOffDays++;
            }
        });
        
        current.setDate(current.getDate() + 1);
    }
    
    return totalOffDays;
}

function calculateIterationWorkingDays(startDate, endDate, teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return 0;
    
    const teamMembers = employees.filter(e => team.members.includes(e.id));
    let totalPersonDays = 0;
    
    // Calculate person-days considering individual personal leaves
    teamMembers.forEach(member => {
        let memberWorkingDays = 0;
        const current = new Date(startDate);
        
        while (current <= endDate) {
            const dayOfWeek = current.getDay();
            const dateStr = current.toISOString().split('T')[0];
            
            // Check if it's a weekend
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // Check if it's a public or team holiday
            const isHoliday = holidays.some(h => {
                if (dateStr >= h.startDate && dateStr <= h.endDate) {
                    if (h.type === 'public') return true;
                    if (h.type === 'team' && h.teamId === teamId) return true;
                }
                return false;
            });
            
            // Check if this member has personal leave
            const hasPersonalLeave = holidays.some(h => {
                return h.type === 'personal' && 
                       h.employeeId === member.id && 
                       dateStr >= h.startDate && 
                       dateStr <= h.endDate;
            });
            
            if (!isWeekend && !isHoliday && !hasPersonalLeave) {
                memberWorkingDays++;
            }
            
            current.setDate(current.getDate() + 1);
        }
        
        totalPersonDays += memberWorkingDays;
    });
    
    // Return average working days per person
    return teamMembers.length > 0 ? Math.round(totalPersonDays / teamMembers.length) : 0;
}

function formatDateShort(date) {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return `${day} ${month}`;
}

function isTeamHoliday(teamId, dateStr) {
    return holidays.some(h => {
        if (h.type === 'public' || (h.type === 'team' && h.teamId === teamId)) {
            return dateStr >= h.startDate && dateStr <= h.endDate;
        }
        return false;
    });
}

// ============ UTILITIES ============

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${day} ${month}`;
}

function formatNumber(num) {
    // For English locale, use comma as thousand separator
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function calculateWorkingDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        // Check if it's a weekend
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Check if it's a public holiday
        const isPublicHoliday = holidays.some(h => 
            h.type === 'public' && dateStr >= h.startDate && dateStr <= h.endDate
        );
        
        if (!isWeekend && !isPublicHoliday) {
            count++;
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    return count;
}

function updateTeamSelectors() {
    // Update employee team selector
    const employeeTeamSelect = document.getElementById('employee-team');
    if (employeeTeamSelect) {
        const currentValue = employeeTeamSelect.value;
        employeeTeamSelect.innerHTML = '<option value="">No Team</option>' +
            teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        employeeTeamSelect.value = currentValue;
    }

    // Update holiday team selector
    const holidayTeamSelect = document.getElementById('holiday-team');
    if (holidayTeamSelect) {
        holidayTeamSelect.innerHTML = '<option value="">Select Team</option>' +
            teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }

    // Update holiday employee selector
    const holidayEmployeeSelect = document.getElementById('holiday-employee');
    if (holidayEmployeeSelect) {
        holidayEmployeeSelect.innerHTML = '<option value="">Select Employee</option>' +
            employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    }
}

// ============ IMPORT/EXPORT ============

// Main export function (called from header)
function exportData() {
    syncBackToOrganization();
    
    const data = {
        config: config,
        publicHolidays: holidaysData.publicHolidays,
        organization: organizationData
    };
    
    const jsonData = JSON.stringify(data, null, 2);
    downloadJSON(jsonData, 'capacity-data.json');
}

function clearAllData() {
    // Ask if user wants to export before clearing
    const wantExport = confirm('Tüm veriler silinecek! Silmeden önce verilerinizi kaydetmek (export) ister misiniz?');
    
    if (wantExport) {
        // Export first
        exportData();
        
        // Then ask again to confirm deletion
        setTimeout(() => {
            const confirmDelete = confirm('Veriler kaydedildi. Şimdi tüm verileri silmek istediğinizden emin misiniz?');
            if (confirmDelete) {
                performClearAll();
            }
        }, 500);
    } else {
        // Direct delete confirmation
        const confirmDelete = confirm('Tüm veriler kalıcı olarak silinecek! Emin misiniz?');
        if (confirmDelete) {
            performClearAll();
        }
    }
}

function performClearAll() {
    // Clear localStorage
    localStorage.removeItem('pi_data');
    
    // Reset all data to defaults
    config = {
        pi: {
            startDate: '',
            endDate: '',
            iterationDurationWeeks: 2
        }
    };
    
    holidaysData = {
        publicHolidays: []
    };
    
    organizationData = {
        teams: []
    };
    
    // Re-sync arrays
    teams = [];
    employees = [];
    holidays = [];
    
    // Save empty data
    saveData();
    
    // Re-render everything
    renderEmployees();
    renderTeams();
    renderHolidays();
    renderCapacitySummary();
    renderGanttChart();
    
    alert('Tüm veriler silindi. Sayfa yenilenecek.');
    location.reload();
}

// Legacy functions (kept for backward compatibility if needed)
function exportEmployees() {
    exportData();
}

function exportTeams() {
    exportData();
}

function downloadJSON(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Main import function (called from header)
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                
                // Check if it's the new unified format
                if (importedData.config && importedData.organization) {
                    // Confirm before overwriting
                    if (!confirm('This will replace all current data. Are you sure you want to continue?')) {
                        return;
                    }
                    
                    // New format - load everything
                    config = importedData.config;
                    holidaysData = { publicHolidays: importedData.publicHolidays || [] };
                    organizationData = importedData.organization;
                    
                    syncLegacyData();
                    saveData();
                    renderEmployees();
                    renderTeams();
                    updateTeamSelectors();
                    updatePIForm();
                    
                    // Refresh timeline if on that tab
                    renderTeamFilters();
                    renderHolidays();
                    renderGanttChart();
                    
                    alert('✅ Successfully imported complete data!\n\n' +
                          `Teams: ${organizationData.teams.length}\n` +
                          `Employees: ${employees.length}\n` +
                          `Public Holidays: ${holidaysData.publicHolidays.length}`);
                } else if (Array.isArray(importedData)) {
                    // Legacy format
                    alert('❌ Legacy format detected.\n\nPlease export data using the new "Export Data" button and re-import.');
                } else {
                    alert('❌ Invalid file format.\n\nExpected: capacity-data.json with config, organization, and publicHolidays.');
                }
            } catch (error) {
                alert('❌ Error importing file:\n\n' + error.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ============ MENU & THEME SYSTEM ============

function toggleMenu(menuId, event) {
    if (event) {
        event.stopPropagation(); // Prevent event bubbling
    }
    
    const menu = document.getElementById(menuId);
    if (!menu) {
        console.error('Menu not found:', menuId);
        return;
    }
    
    console.log('Toggling menu:', menuId, 'Current state:', menu.classList.contains('show'));
    
    const allMenus = document.querySelectorAll('.menu-dropdown');
    const trigger = menu.previousElementSibling;
    
    const isCurrentlyOpen = menu.classList.contains('show');
    
    // Close all other menus
    allMenus.forEach(m => {
        if (m.id !== menuId) {
            m.classList.remove('show');
            if (m.previousElementSibling) {
                m.previousElementSibling.classList.remove('active');
            }
        }
    });
    
    // Toggle current menu
    if (!isCurrentlyOpen) {
        menu.classList.add('show');
        if (trigger) {
            trigger.classList.add('active');
        }
        console.log('Menu opened:', menuId);
    } else {
        menu.classList.remove('show');
        if (trigger) {
            trigger.classList.remove('active');
        }
        console.log('Menu closed:', menuId);
    }
}

function closeAllMenus() {
    document.querySelectorAll('.menu-dropdown').forEach(menu => {
        menu.classList.remove('show');
    });
    document.querySelectorAll('.menu-trigger').forEach(trigger => {
        trigger.classList.remove('active');
    });
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-menu')) {
        closeAllMenus();
    }
});

// Theme System
function initTheme() {
    const savedMode = localStorage.getItem('themeMode') || 'auto';
    const savedColor = localStorage.getItem('themeColor') || 'default';
    applyTheme(savedMode, savedColor);
    updateThemeUI(savedMode, savedColor);
}

function toggleThemeMode(mode) {
    const savedColor = localStorage.getItem('themeColor') || 'default';
    localStorage.setItem('themeMode', mode);
    applyTheme(mode, savedColor);
    updateThemeUI(mode, savedColor);
}

function toggleThemeColor(color) {
    const savedMode = localStorage.getItem('themeMode') || 'auto';
    localStorage.setItem('themeColor', color);
    applyTheme(savedMode, color);
    updateThemeUI(savedMode, color);
}

function applyTheme(mode, color) {
    let effectiveMode = mode;
    
    // Determine effective mode (auto resolves to light or dark)
    if (mode === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveMode = prefersDark ? 'dark' : 'light';
    }
    
    // Apply theme based on mode and color
    let themeValue;
    if (color === 'default') {
        // Use default light or dark theme
        themeValue = effectiveMode; // 'light' or 'dark'
    } else {
        // Use colored theme with mode suffix (ocean-light, ocean-dark, etc.)
        themeValue = `${color}-${effectiveMode}`;
    }
    
    document.documentElement.setAttribute('data-theme', themeValue);
}

function updateThemeUI(mode, color) {
    // Update active state for mode buttons
    document.querySelectorAll('[data-theme-mode]').forEach(btn => {
        if (btn.dataset.themeMode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update active state for color buttons
    document.querySelectorAll('[data-theme-color]').forEach(btn => {
        if (btn.dataset.themeColor === color) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const savedMode = localStorage.getItem('themeMode');
    const savedColor = localStorage.getItem('themeColor') || 'default';
    if (savedMode === 'auto') {
        applyTheme('auto', savedColor);
    }
});

// Initialize theme on load
initTheme();

// Legacy function for backward compatibility
function toggleTheme(theme) {
    // Map old single-value themes to new system
    if (theme === 'light' || theme === 'dark' || theme === 'auto') {
        toggleThemeMode(theme);
    } else {
        toggleThemeColor(theme);
    }
}

// Initialize theme on load
initTheme();

// Legacy functions (kept for backward compatibility if needed)
function importEmployees() {
    importData();
}

function importTeams() {
    importData();
}

