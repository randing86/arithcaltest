/*
 * Arithmetic Game JavaScript implementation (Web Version with Configurable Phases)
 * 
 * Each phase's configuration includes:
 * 1. First number maximum (or a specific number if chosen)
 * 2. Operation (+, -, *, /)
 * 3. Second number maximum (or a specific number if chosen)
 * 4. Limit type: either a fixed number of questions or a time limit (in seconds) for the phase
 * 5. Option to allow negative results
 * 
 * New enhancements:
 * - The arithmetic question is formatted with the operation between the first and second numbers.
 * - A log prevents any question from being displayed more than 3 times during the session, and prevents the same question from showing back-to-back.
 * - When a question is answered incorrectly, the same question is presented until it is answered correctly.
 * - The end game summary shows: the number of questions completed, total time, average time per question, number of right answers, number of wrong attempts, and overall percentage correct.
 */

// Utility function to generate a random integer between min and max (inclusive)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Globals for game state
let gamePhases = [];      // Array of phase objects { config, total }
let currentPhaseIndex = 0;
let currentQuestionIndex = 0;
let currentQuestion = null; // currentQuestion object will include { question, answer }
let startTime = null;     // Overall game start time
let phaseStartTime = null; // Start time for current phase
let timerInterval = null;

// Global tracking for question frequency and ordering
let questionLog = {};      // Log mapping question text to the number of times it has been shown
let lastQuestion = "";     // Last question text displayed

// Counters for performance tracking
let correctCount = 0;      // Number of questions answered correctly (completed)
let wrongCount = 0;        // Total wrong attempts

// UI Elements
const timerElem = document.getElementById('timer');
const questionElem = document.getElementById('question');
const answerInput = document.getElementById('answer');
const submitButton = document.getElementById('submit');
const feedbackElem = document.getElementById('feedback');
const endgamePanel = document.getElementById('endgame-panel');
const endgameMessage = document.getElementById('endgame-message');

// Update the timer display (running timer displayed at top)
function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    timerElem.textContent = `${elapsed} seconds`;
}

// Generate a new question based on provided phase configuration
function generateQuestion(config) {
    let num1, num2, questionText, answer;
    switch (config.operation) {
        case '+':
            num1 = (config.firstSpecific !== undefined) ? config.firstSpecific : randomInt(0, config.firstNum);
            num2 = (config.secondSpecific !== undefined) ? config.secondSpecific : randomInt(0, config.secondNum);
            answer = num1 + num2;
            break;
        case '-':
            num1 = (config.firstSpecific !== undefined) ? config.firstSpecific : randomInt(0, config.firstNum);
            num2 = (config.secondSpecific !== undefined) ? config.secondSpecific : randomInt(0, config.secondNum);
            // Ensure non-negative if not allowed
            if (!config.allowNegative && num1 < num2) {
                if (config.firstSpecific !== undefined && config.secondSpecific !== undefined) {
                    [num1, num2] = [num2, num1];
                } else {
                    num1 = Math.max(num1, num2);
                }
            }
            answer = num1 - num2;
            break;
        case '*':
            num1 = (config.firstSpecific !== undefined) ? config.firstSpecific : randomInt(0, config.firstNum);
            num2 = (config.secondSpecific !== undefined) ? config.secondSpecific : randomInt(0, config.secondNum);
            answer = num1 * num2;
            break;
        case '/':
            if (config.secondSpecific !== undefined) {
                num2 = (config.secondSpecific === 0) ? 1 : config.secondSpecific;
            } else {
                num2 = randomInt(1, config.secondNum > 0 ? config.secondNum : 1);
            }
            if (config.firstSpecific !== undefined) {
                num1 = config.firstSpecific;
                num1 = num1 - (num1 % num2);
            } else {
                let maxQuotient = Math.floor(config.firstNum / num2);
                maxQuotient = maxQuotient < 0 ? 0 : maxQuotient;
                const quotient = randomInt(0, maxQuotient);
                num1 = quotient * num2;
            }
            answer = num1 / num2;
            break;
        default:
            num1 = (config.firstSpecific !== undefined) ? config.firstSpecific : randomInt(0, config.firstNum);
            num2 = (config.secondSpecific !== undefined) ? config.secondSpecific : randomInt(0, config.secondNum);
            answer = num1 + num2;
    }
    // Format the question with the operator between the numbers
    questionText = `What is ${num1} ${config.operation} ${num2}?`;
    return { question: questionText, answer: answer };
}

// Load the next question for the current phase
function loadNextQuestion() {
    // If all phases are completed, end game
    if (currentPhaseIndex >= gamePhases.length) {
        endGame();
        return;
    }
    const phase = gamePhases[currentPhaseIndex];
    const config = phase.config;

    // Check limit for phase
    if (config.limitType === 'time') {
        const phaseElapsed = Math.floor((Date.now() - phaseStartTime) / 1000);
        if (phaseElapsed >= config.limit) {
            currentPhaseIndex++;
            currentQuestionIndex = 0;
            phaseStartTime = Date.now();
            loadNextQuestion();
            return;
        }
    } else { // questions mode
        if (currentQuestionIndex >= phase.total) {
            currentPhaseIndex++;
            currentQuestionIndex = 0;
            phaseStartTime = Date.now();
            loadNextQuestion();
            return;
        }
    }

    // Always generate a new question for the current phase
    let candidate = generateQuestion(config);
    let attempts = 0;
    // Regenerate if candidate has been shown too many times or is the same as the last question
    while (((questionLog[candidate.question] || 0) >= 3 || candidate.question === lastQuestion) && attempts < 10) {
        candidate = generateQuestion(config);
        attempts++;
    }

    // Update logs
    questionLog[candidate.question] = (questionLog[candidate.question] || 0) + 1;
    lastQuestion = candidate.question;
    currentQuestionIndex++;

    currentQuestion = candidate;
    // Display question in the specified format: 
    // Phase X<br>Y. <strong>Question</strong>
    questionElem.innerHTML = `Phase ${currentPhaseIndex + 1}<br>${currentQuestionIndex}. <strong>${currentQuestion.question}</strong>`;
    answerInput.value = '';
    feedbackElem.textContent = '';
}

// Process answer submission
function handleSubmit() {
    const userAnswer = parseInt(answerInput.value.trim(), 10);
    if (isNaN(userAnswer)) {
        feedbackElem.style.color = 'red';
        feedbackElem.textContent = 'Please enter a valid integer answer.';
        return;
    }
    if (userAnswer === currentQuestion.answer) {
        feedbackElem.style.color = 'green';
        feedbackElem.textContent = `Correct! You answered: ${userAnswer}.`;
        correctCount++;
        setTimeout(() => {
            loadNextQuestion();
        }, 1000);
    } else {
        wrongCount++;
        feedbackElem.style.color = 'red';
        feedbackElem.textContent = `Incorrect, you answered: ${userAnswer}. Please try again.`;
        // Do not move to the next question; allow reattempt on the same question.
        answerInput.value = '';
    }
}

// End the game: hide answer input/submit button and show endgame panel
function endGame() {
    clearInterval(timerInterval);
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    answerInput.style.display = 'none';
    submitButton.style.display = 'none';
    // Calculate average time per correctly answered question
    const avgTime = correctCount > 0 ? (totalTime / correctCount).toFixed(2) : 0;
    // Calculate overall percentage correct: percentage of correct answers out of total attempts
    const totalAttempts = correctCount + wrongCount;
    const percentCorrect = totalAttempts > 0 ? ((correctCount / totalAttempts) * 100).toFixed(1) : 0;
    endgameMessage.textContent = `You completed ${correctCount} questions in ${totalTime} seconds (average ${avgTime} seconds per question).
Questions Right: ${correctCount}, Questions Wrong: ${wrongCount} (${percentCorrect}% correct)`;
    endgamePanel.style.display = 'block';
}

// Start the game using configuration from window.gameConfig
function startGame() {
    if (!window.gameConfig || !Array.isArray(window.gameConfig) || window.gameConfig.length === 0) {
        console.error('No game configuration provided.');
        return;
    }
    // Reset global logs and counters for a new game session
    questionLog = {};
    lastQuestion = "";
    correctCount = 0;
    wrongCount = 0;

    gamePhases = window.gameConfig.map(config => {
        return { config: config, total: config.limit };
    });
    currentPhaseIndex = 0;
    currentQuestionIndex = 0;
    answerInput.style.display = 'inline-block';
    submitButton.style.display = 'inline-block';
    endgamePanel.style.display = 'none';
    startTime = Date.now();
    phaseStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    loadNextQuestion();
}

// Event listeners for submit
submitButton.addEventListener('click', handleSubmit);
answerInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        handleSubmit();
    }
});

updateTimer();
window.startGame = startGame;
