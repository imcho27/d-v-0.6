/* ================================================================
   DV VISA PATHWAY HELPER — script.js
   All interactivity, navigation, validation, and summary logic.

   PRIVACY NOTE:
   No data is saved to localStorage, sessionStorage, cookies,
   or any server. Everything lives only in the state object below
   and disappears when the tab is closed or Safe Exit is clicked.
   ================================================================ */


/* ----------------------------------------------------------------
   1. STATE OBJECT
   One central object holds all user answers while the page is open.
   Each property is set by collectAnswers() after each step.
   Nothing here is ever sent anywhere or stored permanently.
   ---------------------------------------------------------------- */

const state = {};


/* ----------------------------------------------------------------
   2. LABEL LOOKUP TABLES
   These convert stored values (e.g. "physical") into readable
   sentences (e.g. "Physical abuse") used in the summary output.
   To add a new option: add a matching entry in the HTML dropdown
   or checkbox, then add the same key + label here.
   ---------------------------------------------------------------- */

const visaTypeLabels = {
    'spouse-civil-partner':    'Spouse or Civil Partner Visa',
    'unmarried-partner':       'Unmarried Partner Visa',
    'fiance':                  'Fiancé(e) Visa',
    'leave-to-remain-partner': 'Leave to Remain as a Partner',
    'refugee':                 'Refugee or Humanitarian Protection',
    'student':                 'Student Visa',
    'work-visa':               'Work Visa',
    'visitor':                 'Visitor Visa',
    'eea-eu':                  'EU / EEA Settlement Scheme (Pre-Settled or Settled Status)',
    'no-leave':                'No current leave / overstayed',
    'other':                   'Other',
    'not-sure':                'Not sure'
};

const locationLabels = {
    'inside-uk': 'Inside the UK',
    'overseas':  'Overseas (outside the UK)',
    'not-sure':  'Not sure'
};

const abuseTypeLabels = {
    'physical':            'Physical abuse',
    'emotional':           'Emotional or psychological abuse',
    'financial':           'Financial or economic abuse',
    'coercive-control':    'Coercive control',
    'sexual':              'Sexual abuse',
    'immigration-control': 'Immigration-related abuse (e.g. threats to report to the Home Office)',
    'digital':             'Digital or online abuse (e.g. monitoring devices or accounts)',
    'threats':             'Threats or intimidation',
    'isolation':           'Isolation from family or friends',
    'other':               'Other',
    'prefer-not-to-say':   'Prefer not to say'
};

const evidenceLabels = {
    'police-report':      'Police report or crime reference number',
    'medical-records':    'Medical records or GP notes',
    'injunction':         'Injunction or restraining order',
    'social-services':    'Social services letter or referral',
    'refuge-letter':      'Letter from a refuge or shelter',
    'dv-support-letter':  'Letter from a domestic abuse support organisation',
    'witness-statements': 'Witness statements from family or friends',
    'messages':           'Screenshots or records of threatening messages',
    'counsellor-letter':  'Letter from a counsellor or therapist',
    'no-evidence':        'No evidence currently available'
};

const monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];


/* ----------------------------------------------------------------
   3. SAFE EXIT
   Immediately clears the state object and redirects the browser
   to google.co.uk using window.location.replace() so the Back
   button cannot return to this tool.
   ---------------------------------------------------------------- */

function safeExit() {
    // Remove every property from the in-memory state object
    Object.keys(state).forEach(function(k) { delete state[k]; });

    // Replace current page so it is removed from browser history
    window.location.replace('https://www.google.co.uk');
}


/* ----------------------------------------------------------------
   4. STEP NAVIGATION
   showStep()        — makes one section visible, hides all others
   updateProgressBar() — updates the progress bar and step label
   nextStep()        — validates then advances to the next step
   prevStep()        — goes back one step without validating
   ---------------------------------------------------------------- */

const TOTAL_STEPS = 6; // Steps 1–6 (support page is outside this count)

// Makes the requested step (1–6), 'welcome', or 'support' page visible.
// Hides every other section first.
function showStep(stepNumber) {
    // Hide all step sections
    var allSections = document.querySelectorAll('.step-section');
    allSections.forEach(function(section) {
        section.classList.remove('active');
    });

    if (stepNumber === 'welcome') {
        // Show the welcome / safety notice page
        document.getElementById('welcome-page').classList.add('active');
        // Hide progress bar — user has not entered a numbered step yet
        document.getElementById('progress-container').style.display = 'none';

    } else if (stepNumber === 'support') {
        // Show the local support page
        document.getElementById('support-page').classList.add('active');
        // Keep progress bar visible and at 100%
        document.getElementById('progress-container').style.display = 'block';
        updateProgressBar(6);

    } else {
        // Show the numbered step (1–6)
        // Make progress bar visible in case it was hidden on welcome page
        document.getElementById('progress-container').style.display = 'block';
        var target = document.getElementById('step-' + stepNumber);
        if (target) {
            target.classList.add('active');
            updateProgressBar(stepNumber);
        }
    }

    // Always scroll back to the top when changing steps
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Sets the width of the progress bar and the step label text.
// stepNumber should be 1–6.
function updateProgressBar(stepNumber) {
    var fill    = document.getElementById('progress-bar-fill');
    var label   = document.getElementById('step-label');
    var percent = Math.round((stepNumber / TOTAL_STEPS) * 100);

    fill.style.width = percent + '%';

    if (stepNumber < TOTAL_STEPS) {
        label.textContent = 'Step ' + stepNumber + ' of ' + TOTAL_STEPS;
    } else {
        label.textContent = 'Summary complete';
    }
}

// Called by the Start button on the welcome page.
// Checks that the user has ticked the agreement checkbox.
// If not ticked: shows an error message and stays on the welcome page.
// If ticked: clears the error and moves to Step 1.
// Note: error is handled directly here because the welcome error uses
// id="error-welcome", not the "error-step-N" pattern used by showError().
function startTool() {
    var agreed  = document.getElementById('welcome-agree').checked;
    var errorEl = document.getElementById('error-welcome');

    if (!agreed) {
        errorEl.textContent = 'Please tick the checkbox to confirm you understand before continuing.';
        errorEl.classList.add('visible');
        // Scroll the error into view on small screens
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
    }

    // Checkbox is ticked — clear any error and go to Step 1
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
    showStep(1);
}


// Called by the Next button on each step.
// Validates first — if invalid, stops and shows an error.
// If valid, saves answers to state and moves forward.
function nextStep(currentStep) {
    var isValid = validateStep(currentStep);
    if (!isValid) return; // Do not advance if validation fails

    collectAnswers(currentStep); // Save this step's answers into state

    if (currentStep === 5) {
        // Step 5 is the last question step — generate summary then show Step 6
        generateSummary();
        showStep(6);
    } else {
        showStep(currentStep + 1);
    }
}

// Called by the Back button on each step.
// Does not validate — user is allowed to go back freely.
function prevStep(currentStep) {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}


/* ----------------------------------------------------------------
   5. VALIDATION — ONE FUNCTION PER STEP
   Each function returns true (pass) or false (fail).
   On failure it displays a message using showError().
   validateStep() is the single entry point — it calls the right one.
   ---------------------------------------------------------------- */

function validateStep(stepNumber) {
    switch (stepNumber) {
        case 1: return validateStep1();
        case 2: return validateStep2();
        case 3: return validateStep3();
        case 4: return validateStep4();
        case 5: return validateStep5();
        default: return true;
    }
}

// Displays an error message paragraph below the form on a given step.
function showError(stepNumber, message) {
    var el = document.getElementById('error-step-' + stepNumber);
    if (el) {
        el.textContent = message;
        el.classList.add('visible');
        // Scroll the error into view so the user sees it on mobile
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Clears and hides the error message for a given step.
function clearError(stepNumber) {
    var el = document.getElementById('error-step-' + stepNumber);
    if (el) {
        el.textContent = '';
        el.classList.remove('visible');
    }
}

// Step 1: visa type must be chosen AND location must be selected.
function validateStep1() {
    clearError(1);

    var visaType = document.getElementById('visa-type').value;
    var location = document.querySelector('input[name="location"]:checked');

    if (!visaType) {
        showError(1, 'Please select your most recent visa or permission to stay.');
        return false;
    }
    if (!location) {
        showError(1, 'Please tell us whether you are applying from inside the UK or overseas.');
        return false;
    }
    return true;
}

// Step 2: both yes/no questions must be answered.
function validateStep2() {
    clearError(2);

    var breakdown  = document.querySelector('input[name="relationship-breakdown"]:checked');
    var abuseCause = document.querySelector('input[name="abuse-caused-breakdown"]:checked');

    if (!breakdown) {
        showError(2, 'Please answer whether your relationship has permanently broken down.');
        return false;
    }
    if (!abuseCause) {
        showError(2, 'Please answer whether domestic abuse contributed to the breakdown.');
        return false;
    }
    return true;
}

// Step 3: at least one abuse type must be checked.
function validateStep3() {
    clearError(3);

    var checked = document.querySelectorAll('input[name="abuse-type"]:checked');
    if (checked.length === 0) {
        showError(3, 'Please select at least one option, or choose "I prefer not to say".');
        return false;
    }
    return true;
}

// Step 4: at least one evidence option must be checked.
function validateStep4() {
    clearError(4);

    var evidence = document.querySelectorAll('input[name="evidence"]:checked');
    if (evidence.length === 0) {
        showError(4, 'Please select at least one evidence option, or select "I do not have any evidence at the moment".');
        return false;
    }
    return true;
}

// Step 5: yes/no questions about current situation.
// None are strictly required — the user may not be safe or ready
// to answer every question. We clear any leftover error and allow
// the step to proceed.
function validateStep5() {
    clearError(5);
    return true;
}


/* ----------------------------------------------------------------
   6. COLLECT ANSWERS INTO STATE
   Called after each step is validated.
   Reads the current form values and stores them in the state object.
   ---------------------------------------------------------------- */

function collectAnswers(stepNumber) {

    if (stepNumber === 1) {
        state.visaType = document.getElementById('visa-type').value;
        var locationEl = document.querySelector('input[name="location"]:checked');
        state.location = locationEl ? locationEl.value : '';
    }

    if (stepNumber === 2) {
        var breakdownEl  = document.querySelector('input[name="relationship-breakdown"]:checked');
        var abuseCauseEl = document.querySelector('input[name="abuse-caused-breakdown"]:checked');
        state.relationshipBreakdown = breakdownEl  ? breakdownEl.value  : '';
        state.abuseCausedBreakdown  = abuseCauseEl ? abuseCauseEl.value : '';
    }

    if (stepNumber === 3) {
        var abuseBoxes = document.querySelectorAll('input[name="abuse-type"]:checked');
        state.abuseTypes = Array.from(abuseBoxes).map(function(cb) { return cb.value; });
    }

    if (stepNumber === 4) {
        // Step 4 collects evidence checkboxes only
        var evidenceBoxes = document.querySelectorAll('input[name="evidence"]:checked');
        state.evidence = Array.from(evidenceBoxes).map(function(cb) { return cb.value; });
    }

    if (stepNumber === 5) {
        // Step 5 collects current situation yes/no questions
        var livingEl   = document.querySelector('input[name="still-living-with-abuser"]:checked');
        var worriedEl  = document.querySelector('input[name="worried-abuser-finds-out"]:checked');
        var urgentEl   = document.querySelector('input[name="urgent-help"]:checked');
        var ukviEl     = document.querySelector('input[name="ukvi-access"]:checked');
        var childrenEl = document.querySelector('input[name="has-children"]:checked');
        var hoEl       = document.querySelector('input[name="home-office-contact"]:checked');

        state.stillLivingWithAbuser = livingEl   ? livingEl.value   : '';
        state.worriedAbuserFindsOut = worriedEl  ? worriedEl.value  : '';
        state.urgentHelp            = urgentEl   ? urgentEl.value   : '';
        state.ukviAccess            = ukviEl     ? ukviEl.value     : '';
        state.hasChildren           = childrenEl ? childrenEl.value : '';
        state.homeOfficeContact     = hoEl       ? hoEl.value       : '';

        // Children follow-up — only collected if user selected Yes
        if (state.hasChildren === 'yes') {
            state.childrenCount      = document.getElementById('children-count').value || 'Not specified';
            var under18El            = document.querySelector('input[name="children-under-18"]:checked');
            var disabilityEl         = document.querySelector('input[name="children-disability"]:checked');
            state.childrenUnder18    = under18El    ? under18El.value    : 'Not answered';
            state.childrenDisability = disabilityEl ? disabilityEl.value : 'Not answered';
        }

        // Visa expiry
        state.visaExpiryMonth = document.getElementById('visa-expiry-month').value;
        state.visaExpiryYear  = document.getElementById('visa-expiry-year').value;
    }
}


/* ----------------------------------------------------------------
   7. CHILDREN QUESTIONS TOGGLE
   Called by onclick on the Yes / No radios in Step 4.
   Shows or hides the follow-up block inside #children-questions.
   ---------------------------------------------------------------- */

function showChildrenQuestions() {
    document.getElementById('children-questions').style.display = 'block';
}

function hideChildrenQuestions() {
    document.getElementById('children-questions').style.display = 'none';
}


/* ----------------------------------------------------------------
   8. SUMMARY HELPER FUNCTIONS
   Small reusable functions that build HTML strings for the summary.
   ---------------------------------------------------------------- */

// Converts raw radio values into readable Yes / No / Not sure text.
function yesNo(value) {
    if (value === 'yes')      return 'Yes';
    if (value === 'no')       return 'No';
    if (value === 'unsure')   return 'Not sure';
    if (value === 'not-sure') return 'Not sure';
    return value || 'Not answered';
}

// Wraps a title and body HTML into a styled summary section card.
function summarySection(title, bodyHTML) {
    return (
        '<div class="summary-section">' +
            '<div class="summary-section-title">' + title + '</div>' +
            '<div class="summary-section-body">' + bodyHTML + '</div>' +
        '</div>'
    );
}

// Creates a single label + value row for inside a summary section.
function summaryRow(label, value) {
    return (
        '<div class="summary-row">' +
            '<span class="summary-label">' + label + '</span>' +
            '<span class="summary-value">' + value + '</span>' +
        '</div>'
    );
}

// Formats the visa expiry month + year into a readable string.
function formatVisaExpiry() {
    var month = state.visaExpiryMonth;
    var year  = state.visaExpiryYear;

    if (!month && !year)       return 'Not provided';
    if (year === 'dont-know')  return 'Not known';
    if (!month || !year)       return 'Partially provided';

    return monthNames[parseInt(month, 10)] + ' ' + year;
}

// Returns true if the visa expires within 3 months from today.
// Used to decide whether to show the urgent timeline warning.
function visaExpiringSoon() {
    var year  = state.visaExpiryYear;
    var month = state.visaExpiryMonth;

    if (!year || !month || year === 'dont-know') return false;

    var expiry          = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    var today           = new Date();
    var threeMonthsAway = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());

    return expiry <= threeMonthsAway;
}


/* ----------------------------------------------------------------
   9. GENERATE SUMMARY
   Builds a compact at-a-glance preview + personalised key guidance
   and injects them into #summary-output.
   Called automatically when the user reaches Step 6.
   ---------------------------------------------------------------- */

function buildSummaryPreview() {
    var visaType = visaTypeLabels[state.visaType] || state.visaType || 'Not provided';
    var location = locationLabels[state.location] || state.location || 'Not provided';

    var abuseText;
    if (!state.abuseTypes || state.abuseTypes.length === 0) {
        abuseText = 'Not provided';
    } else if (state.abuseTypes.includes('prefer-not-to-say')) {
        abuseText = 'Prefer not to say';
    } else if (state.abuseTypes.length === 1) {
        abuseText = abuseTypeLabels[state.abuseTypes[0]] || state.abuseTypes[0];
    } else {
        abuseText = state.abuseTypes.length + ' types indicated';
    }

    var evidenceText;
    if (!state.evidence || state.evidence.length === 0) {
        evidenceText = 'Not provided';
    } else if (state.evidence.includes('no-evidence')) {
        evidenceText = 'No evidence currently held';
    } else if (state.evidence.length === 1) {
        evidenceText = evidenceLabels[state.evidence[0]] || state.evidence[0];
    } else {
        evidenceText = state.evidence.length + ' items held';
    }

    var expiryText = formatVisaExpiry();
    if (visaExpiringSoon()) {
        expiryText = expiryText + ' — expiring very soon, seek legal advice promptly';
    } else if (state.urgentHelp === 'yes') {
        expiryText = expiryText + ' — urgent housing or financial support may be needed';
    }

    function previewRow(label, value) {
        return (
            '<div class="summary-preview-item">' +
                '<span class="summary-preview-label">' + label + '</span>' +
                '<span class="summary-preview-value">' + value  + '</span>' +
            '</div>'
        );
    }

    var rows = '';
    rows += previewRow('Visa / permission held', visaType);
    rows += previewRow('Applying from',          location);
    rows += previewRow('Abuse indicated',        abuseText);
    rows += previewRow('Evidence held',          evidenceText);
    rows += previewRow('Visa / leave expiry',    expiryText);

    return (
        '<div class="summary-preview">' +
            '<div class="summary-preview-heading">Your Summary at a Glance</div>' +
            rows +
        '</div>'
    );
}

/* ----------------------------------------------------------------
   9b. EVIDENCE SNAPSHOT BUILDER
   Returns a compact card summarising the user's evidence position
   based on the count of selected evidence items.
   No strength assessments. No eligibility judgements.
   ---------------------------------------------------------------- */

function buildEvidenceSnapshot() {
    /* Filter out the 'no-evidence' sentinel — count real items only */
    var realEvidence = state.evidence
        ? state.evidence.filter(function(e) { return e !== 'no-evidence'; })
        : [];
    var evidenceCount = realEvidence.length;

    var heading, text;

    if (evidenceCount === 0) {
        heading = 'Evidence position needs review';
        text =
            'Your answers suggest that supporting evidence may still need to be gathered. ' +
            'A personal statement and advice from a qualified adviser may be important.';
    } else if (evidenceCount <= 2) {
        heading = 'Some supporting evidence indicated';
        text =
            'Your answers show some supporting evidence has been identified. ' +
            'It may still be important to explain your situation clearly in a personal statement.';
    } else {
        heading = 'Several evidence items indicated';
        text =
            'Your answers show several types of supporting evidence have been identified. ' +
            'A qualified adviser or solicitor can help organise this evidence clearly.';
    }

    /* Short evidence list — shown only when at least one real item exists */
    var listHTML = '';
    if (realEvidence.length > 0) {
        var displayItems = realEvidence.slice(0, 3);
        var hasMore      = realEvidence.length > 3;

        var items = displayItems.map(function(e) {
            return '<li>' + (evidenceLabels[e] || e) + '</li>';
        }).join('');

        var moreHTML = hasMore
            ? '<p class="evidence-snapshot-more">and other evidence indicated</p>'
            : '';

        listHTML =
            '<p class="evidence-snapshot-label">Evidence indicated</p>' +
            '<ul class="evidence-snapshot-list">' + items + '</ul>' +
            moreHTML;
    }

    return (
        '<div class="evidence-snapshot">' +
            '<div class="evidence-snapshot-heading">' + heading + '</div>' +
            '<p class="evidence-snapshot-text">' + text + '</p>' +
            listHTML +
        '</div>'
    );
}


/* ----------------------------------------------------------------
   9c. URGENT SUPPORT NOTE BUILDER
   Returns an empty string if no urgent triggers are present.
   MVDAC note shown for inside-UK + urgent trigger only.
   Helpline note shown for any urgent trigger regardless of location.
   ---------------------------------------------------------------- */

function buildUrgentSupportNote() {
    var insideUK = state.location === 'inside-uk';
    var urgentTrigger = (
        state.urgentHelp            === 'yes' ||
        state.stillLivingWithAbuser === 'yes' ||
        state.worriedAbuserFindsOut === 'yes'
    );

    if (!urgentTrigger) {
        return '';
    }

    var innerHTML = '';

    if (insideUK) {
        innerHTML +=
            '<div class="guidance-cards">' +
                '<div class="guidance-card">' +
                    '<div class="guidance-card-title">Urgent support option</div>' +
                    '<div class="guidance-card-text">' +
                        'Because you indicated that you are inside the UK and may need urgent safety, ' +
                        'housing or financial support, you may wish to ask a solicitor or qualified adviser ' +
                        'about the Migrant Victims of Domestic Abuse Concession (MVDAC). ' +
                        'This may provide temporary immigration permission and access to public funds ' +
                        'while longer-term options are considered.' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    innerHTML +=
        '<p class="helpline-note">' +
            'If you are in immediate danger, call 999. For domestic abuse support, you can contact the ' +
            'National Domestic Abuse Helpline on 0808 2000 247.' +
        '</p>';

    return (
        '<div class="summary-guidance">' +
            innerHTML +
        '</div>'
    );
}


function generateSummary() {
    var html = '';

    /* Compact at-a-glance preview */
    html += buildSummaryPreview();

    /* Evidence snapshot */
    html += buildEvidenceSnapshot();

    /* Urgent support note — only renders when relevant */
    html += buildUrgentSupportNote();

    /* Personalised key guidance cards */
    html += buildKeyGuidance();

    // Write the preview and guidance into the page
    document.getElementById('summary-output').innerHTML = html;

    // Update the right status panel dynamically based on answers
    var status = buildPanelStatus();
    var panel  = document.getElementById('results-panel');
    panel.className = 'panel-status--' + status.level;
    document.querySelector('.results-panel-inner').innerHTML =
        '<div class="results-panel-icon">' + status.icon + '</div>' +
        '<h3 class="results-panel-heading">' + status.heading + '</h3>' +
        '<p class="results-panel-text">' + status.text + '</p>' +
        '<div class="trust-pills">' +
            '<span class="trust-pill">Not legal advice</span>' +
            '<span class="trust-pill">No data stored</span>' +
            '<span class="trust-pill">Use for solicitor/support discussion</span>' +
        '</div>';
}


/* ----------------------------------------------------------------
   10. KEY GUIDANCE BUILDER
   Assembles a personalised list of guidance points based on what
   the user has told us. Each condition below adds a relevant point.
   ---------------------------------------------------------------- */

function buildKeyGuidance() {
    var cards = [];

    /* No support organisation letter — recommend seeking one */
    if (!state.evidence || !state.evidence.includes('dv-support-letter')) {
        cards.push({
            title: 'Support organisation letter',
            text:
                'Where possible, obtaining a letter or referral from a domestic abuse support ' +
                'organisation — such as through a local IDVA service or MARAC referral — ' +
                'can significantly strengthen your application. Organisations such as ' +
                "Women's Aid Luton or Luton All Women's Centre may be able to assist."
        });
    }

    /* Worried abuser will find out — confidentiality note */
    if (state.worriedAbuserFindsOut === 'yes') {
        cards.push({
            title: 'Keeping your application confidential',
            text:
                'You have indicated concern that the abuser may find out about this application. ' +
                'Please discuss confidentiality arrangements with your solicitor. ' +
                'It is possible to request that all Home Office correspondence is sent to ' +
                'a safe alternative address.'
        });
    }

    /* No or uncertain UKVI access */
    if (state.ukviAccess === 'no' || state.ukviAccess === 'not-sure') {
        cards.push({
            title: 'UKVI online account',
            text:
                'If you do not have access to your own UKVI online account, a solicitor ' +
                'can help you set one up or manage the application on your behalf.'
        });
    }

    /* Previous Home Office contact */
    if (state.homeOfficeContact === 'yes') {
        cards.push({
            title: 'Previous Home Office contact',
            text:
                'You have had previous contact with the Home Office about this situation. ' +
                'It is important that a solicitor reviews the full history of your case ' +
                'before any new application is submitted.'
        });
    }

    /* Children with disability — additional needs note */
    if (state.childrenDisability === 'yes') {
        cards.push({
            title: 'Dependent child with additional needs',
            text:
                'You have indicated that a dependent child has a disability or additional needs. ' +
                'This should be included in your application. A solicitor can advise on how ' +
                'best to present this information.'
        });
    }

    /* Build the intro paragraph */
    var introHTML =
        '<div class="guidance-intro">' +
            '<p>Evidence is considered <em>in the round</em>. Even if you have limited ' +
            'documentation, your personal statement and other supporting information ' +
            'are important and will be taken into account.</p>' +
            '<p>The impact of trauma is recognised in domestic abuse immigration applications. ' +
            'You are not expected to recall every detail perfectly. A solicitor can help ' +
            'you present your account clearly and sensitively.</p>' +
        '</div>';

    /* Build the personalised cards */
    var cardsHTML = '';
    if (cards.length > 0) {
        var cardItems = cards.map(function(c) {
            return (
                '<div class="guidance-card">' +
                    '<div class="guidance-card-title">' + c.title + '</div>' +
                    '<div class="guidance-card-text">' + c.text + '</div>' +
                '</div>'
            );
        }).join('');
        cardsHTML = '<div class="guidance-cards">' + cardItems + '</div>';
    }

    /* Timeline warning — shown separately below the cards */
    var timelineWarning = buildTimelineWarning();

    return (
        '<div class="summary-guidance">' +
            '<h3>Key Guidance</h3>' +
            introHTML +
            cardsHTML +
            timelineWarning +
        '</div>'
    );
}

// Builds the orange timeline warning box based on visa expiry date.
// Returns an empty string if no warning is needed.
function buildTimelineWarning() {
    var year  = state.visaExpiryYear;
    var month = state.visaExpiryMonth;

    // Unknown expiry — prompt user to find out urgently
    if (year === 'dont-know' || (!month && !year)) {
        return (
            '<div class="summary-warning">' +
            '<strong>Timeline note:</strong> Your visa expiry date is unknown. ' +
            'It is important to establish whether your current leave is still valid as soon as possible. ' +
            'An overstayed visa does not necessarily prevent an application, but it may affect the process. ' +
            'Please seek legal advice promptly.' +
            '</div>'
        );
    }

    // Expiry within 3 months — urgent warning
    if (visaExpiringSoon()) {
        return (
            '<div class="summary-warning">' +
            '<strong>Urgent timeline warning:</strong> Your visa or leave to remain is expiring very soon. ' +
            'You should seek legal advice as soon as possible. ' +
            'Applying before your leave expires is strongly recommended wherever it is safe to do so.' +
            '</div>'
        );
    }

    return ''; // No warning needed
}


/* ----------------------------------------------------------------
   11. PANEL STATUS BUILDER
   Evaluates the user's answers and returns one of three DV-safe
   status levels: 'urgent', 'important', or 'prepared'.
   Urgent always overrides important. Prepared is the safe default.
   No risk labels. No pass/fail wording.
   ---------------------------------------------------------------- */

function buildPanelStatus() {

    /* --- Urgent triggers --- */
    var hasUrgentConcern = (
        state.stillLivingWithAbuser === 'yes' ||
        state.worriedAbuserFindsOut === 'yes' ||
        state.urgentHelp           === 'yes' ||
        visaExpiringSoon()
    );

    /* Previous HO contact combined with any other urgent concern */
    var hoContactWithUrgent = (
        state.homeOfficeContact === 'yes' && (
            state.stillLivingWithAbuser === 'yes' ||
            state.worriedAbuserFindsOut === 'yes' ||
            state.urgentHelp           === 'yes' ||
            visaExpiringSoon()
        )
    );

    if (hasUrgentConcern || hoContactWithUrgent) {
        return {
            level:   'urgent',
            heading: 'Urgent Support Recommended',
            text:    'Your answers suggest you may need urgent safety, housing, financial, or immigration support.',
            icon:    '!'
        };
    }

    /* --- Important triggers (only reached if urgent is not triggered) --- */
    var noEvidence = (
        !state.evidence ||
        state.evidence.length === 0 ||
        state.evidence.includes('no-evidence')
    );

    var visaUnknown = (
        state.visaExpiryYear === 'dont-know' ||
        (!state.visaExpiryYear && !state.visaExpiryMonth)
    );

    var hasImportantConcern = (
        noEvidence ||
        state.homeOfficeContact === 'yes' ||
        state.ukviAccess        === 'no'  ||
        state.ukviAccess        === 'not-sure' ||
        state.hasChildren       === 'yes' ||
        visaUnknown
    );

    if (hasImportantConcern) {
        return {
            level:   'important',
            heading: 'Important Points Identified',
            text:    'Your answers show points that may need careful explanation or supporting evidence.',
            icon:    '!'
        };
    }

    /* --- Default: prepared --- */
    return {
        level:   'prepared',
        heading: 'Summary Prepared',
        text:    'Your summary has been prepared from your answers. You may use it to discuss your situation with a solicitor or support adviser.',
        icon:    ''
    };
}


/* ----------------------------------------------------------------
   12. EDIT SUMMARY
   Takes the user back to Step 1. All form fields retain their
   previously selected values so the user can change specific answers.
   ---------------------------------------------------------------- */

function editSummary() {
    showStep(1);
}


/* ----------------------------------------------------------------
   12. DOWNLOAD SUMMARY
   Builds a plain text version of the summary and downloads it as
   dv-summary.txt using a Blob URL. No server is involved.
   The file is created entirely in the browser and is never uploaded.
   ---------------------------------------------------------------- */

function downloadSummary() {
    var today  = new Date();
    var dateStr = today.getDate() + ' ' + monthNames[today.getMonth() + 1] + ' ' + today.getFullYear();

    // Build the plain text content line by line
    var lines = [];

    lines.push('DV VISA PATHWAY HELPER - CASE SUMMARY');
    lines.push('========================================');
    lines.push('Generated: ' + dateStr);
    lines.push('');
    lines.push('IMPORTANT DISCLAIMER:');
    lines.push('This summary is not legal advice and does not confirm eligibility');
    lines.push('for any visa route or immigration application. Please speak to a');
    lines.push('qualified immigration solicitor for a full assessment of your case.');
    lines.push('');

    lines.push('--- RELATIONSHIP & ELIGIBILITY ---');
    lines.push('Most recent visa / permission: ' + (visaTypeLabels[state.visaType] || state.visaType || 'Not provided'));
    lines.push('Applying from: '                 + (locationLabels[state.location] || state.location || 'Not provided'));
    lines.push('Relationship permanently broken down: ' + yesNo(state.relationshipBreakdown));
    lines.push('Breakdown caused by domestic abuse: '   + yesNo(state.abuseCausedBreakdown));
    lines.push('');

    lines.push('--- TYPES OF ABUSE ---');
    if (state.abuseTypes && state.abuseTypes.length > 0) {
        state.abuseTypes.forEach(function(t) {
            lines.push('  - ' + (abuseTypeLabels[t] || t));
        });
    } else {
        lines.push('  Not provided');
    }
    lines.push('');

    lines.push('--- EVIDENCE COLLECTED ---');
    if (state.evidence && state.evidence.length > 0) {
        state.evidence.forEach(function(e) {
            lines.push('  - ' + (evidenceLabels[e] || e));
        });
    } else {
        lines.push('  Not provided');
    }
    lines.push('');

    if (state.hasChildren === 'yes') {
        lines.push('--- CHILDREN ---');
        lines.push('Number of dependent children: '               + (state.childrenCount || 'Not specified'));
        lines.push('Any child under 18: '                         + yesNo(state.childrenUnder18));
        lines.push('Any child with disability / additional needs: '+ yesNo(state.childrenDisability));
        lines.push('');
    }

    lines.push('--- CURRENT SITUATION ---');
    lines.push('Still living with the abuser: '         + yesNo(state.stillLivingWithAbuser));
    lines.push('Worried abuser will find out: '         + yesNo(state.worriedAbuserFindsOut));
    lines.push('Urgent help needed (housing / money): ' + yesNo(state.urgentHelp));
    lines.push('Access to own UKVI account: '           + yesNo(state.ukviAccess));
    lines.push('Previous Home Office contact: '         + yesNo(state.homeOfficeContact));
    lines.push('Visa / leave expiry: '                  + formatVisaExpiry());
    lines.push('');

    lines.push('--- SUGGESTED NEXT STEPS ---');
    lines.push('- Save or download your summary using the button below.');
    lines.push('- Consider preparing a short personal statement in your own words.');
    lines.push('- Keep any evidence you have in a safe place where the abuser cannot access it.');
    lines.push('- Speak to a solicitor as a priority if your visa is expiring soon, you have');
    lines.push('  received a refusal, or you are unsure about your UKVI account.');
    lines.push('- Contact local support if you need help with housing, money, safety, or your children.');
    lines.push('');
    lines.push('--- LEGAL DISCLAIMER ---');
    lines.push('This tool does not provide legal advice, does not confirm eligibility, and does');
    lines.push('not guarantee any Home Office decision. Domestic abuse immigration cases are');
    lines.push('evidence-sensitive and should be reviewed by a qualified adviser or solicitor');
    lines.push('where possible.');
    lines.push('');
    lines.push('KQ Solicitors specialises in domestic abuse immigration cases.');
    lines.push('');
    lines.push('--- END OF SUMMARY ---');

    // Join all lines into one string
    var text = lines.join('\n');

    // Create a downloadable file from the text using a Blob
    var blob = new Blob([text], { type: 'text/plain' });
    var url  = URL.createObjectURL(blob);

    // Create an invisible <a> link, click it programmatically, then remove it
    var link      = document.createElement('a');
    link.href     = url;
    link.download = 'dv-summary.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the temporary object URL from browser memory
    URL.revokeObjectURL(url);
}


/* ----------------------------------------------------------------
   13. TOGGLE INFO BOXES ON THE RESULTS PAGE
   Clicking the button shows or hides the relevant info box.
   If the box is being shown, the page scrolls to it automatically.
   ---------------------------------------------------------------- */

// Personal statement guidance toggle
function togglePersonalStatementGuidance() {
    var box = document.getElementById('personal-statement-guidance');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Solicitor contact toggle
function toggleSolicitorContact() {
    var box = document.getElementById('solicitor-contact');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}


/* ----------------------------------------------------------------
   14. SUPPORT PAGE NAVIGATION
   showSupportPage() is called by the "Find Local Support" button.
   To return from the support page, the Back button calls showStep(6).
   ---------------------------------------------------------------- */

function showSupportPage() {
    showStep('support');
}


/* ----------------------------------------------------------------
   15. INITIALISE ON PAGE LOAD
   Runs once when the browser has finished loading the HTML.
   Makes sure Step 1 is active and visible when the tool first opens.
   ---------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', function() {
    showStep('welcome');
});
