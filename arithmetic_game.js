/*
 * Arithmetic Game JavaScript implementation (Web Version with Configurable Phases and Review Mechanism)
 * This file provides a web-based interface for the arithmetic game where the user can configure up to 3 phases.
 * Each phase's configuration includes:
 * 1. First number maximum (or a specific number if chosen)
 * 2. Operation (+, -, *, /)
 * 3. Second number maximum (or a specific number if chosen)
 * 4. Limit type: either a fixed number of questions or a time limit (in seconds) for the phase
 * 5. Option to allow negative results
 * 
 * In addition, when a problem is answered incorrectly, the problem is tracked and repeated later in the problem set.
 * If a problem is answered incorrectly multiple times, it will be repeated until it has been answered correctly as many times as it was answered incorrectly.
 * Persistently, unresolved problems are stored and will reappear in future instances until mastered.
 * 
 * NEW ENHANCEMENTS:
 * - The arithmetic question is formatted with the operation placed between the first and second numbers.
 * - A log prevents any question from being repeated more than 3 times during the session.
 * - The same question will not be displayed consecutively.
 * - The question display format is updated to show:
 *       Phase 1
 *       1. What is 5 - 5?
 * - The end game message now displays the total questions, total time, and average time per question.
 */

// Utility function to generate a random integer between min and max (inclusive)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Globals for game state
let gamePhases = [];      // Array of phase objects { config, total }
let currentPhaseIndex = 0;
let currentQuestionIndex = 0;
let currentQuestion = null; // currentQuestion object will include { question, answer, fromReview (bool), reviewData (object) }
let startTime = null;     // Overall game start time
let phaseStartTime = null; // Start time for current phase
let timerInterval = null;

// Global tracking for question frequency and ordering
let totalQuestionsAnswered = 0;             // Total number of questions answered in this session
let questionLog = {};                       // Log mapping question text to the number of times it has been shown
let lastQuestion = "";                      // Last question text displayed

// Review queue for questions answered incorrectly
// Each item: { question: <string>, answer: <number>, required: <number>, correctCount: <number> }
let reviewQueue = [];

// LocalStorage key for persistent review data
const REVIEW_STORAGE_KEY = 'reviewQueue';

// UI Elements
const timerElem = document.getElementById('timer');
const questionElem = document.getElementById('question');
const answerInput = document.getElementById('answer');
const submitButton = document.getElementById('submit');
const feedbackElem = document.getElementById('feedback');
const endgamePanel = document.getElementById('endgame-panel');
const endgameMessage = document.getElementById('endgame-message');

// Persistent reviewQueue functions
function loadPersistentReviewQueue() {
    const data = localStorage.getItem(REVIEW_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function savePersistentReviewQueue() {
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviewQueue));
}

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

    let candidate = null;
    // Every 3 questions, if reviewQueue is non-empty, serve a review question
    if (reviewQueue.length > 0 && (currentQuestionIndex % 3 === 0)) {
        candidate = reviewQueue.shift();
        candidate.fromReview = true;
        // If this candidate has been displayed too many times or is the same as the last question, skip it
        if ((questionLog[candidate.question] || 0) >= 3 || candidate.question === lastQuestion) {
            loadNextQuestion();
            return;
        }
    } else {
        candidate = generateQuestion(config);
        candidate.fromReview = false;
        let attempts = 0;
        // Regenerate if candidate has been shown too many times or is same as last question
        while (((questionLog[candidate.question] || 0) >= 3 || candidate.question === lastQuestion) && attempts < 10) {
            candidate = generateQuestion(config);
            candidate.fromReview = false;
            attempts++;
        }
    }

    // Update logs
    questionLog[candidate.question] = (questionLog[candidate.question] || 0) + 1;
    lastQuestion = candidate.question;
    totalQuestionsAnswered++;

    currentQuestion = candidate;
    currentQuestionIndex++;
    // Update question display in the specified format:
    // Phase X
    // Y. <strong>Question</strong>
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
        // If this was a review question, update its record
        if (currentQuestion.fromReview) {
            if (!currentQuestion.reviewData) {
                // Initialize review data
                currentQuestion.reviewData = { required: 1, correctCount: 0 };
            }
            currentQuestion.reviewData.correctCount++;
            if (currentQuestion.reviewData.correctCount < currentQuestion.reviewData.required) {
                // Not mastered yet, requeue the review question
                reviewQueue.push(currentQuestion);
            }
        }
        setTimeout(() => {
            savePersistentReviewQueue();
            loadNextQuestion();
        }, 1000);
    } else {
        feedbackElem.style.color = 'red';
        feedbackElem.textContent = `Incorrect, you answered: ${userAnswer}. This problem will be reviewed later.`;
        // Log this incorrect attempt in the review queue
        let found = false;
        // Check if this problem is already in reviewQueue (by question text)
        for (let item of reviewQueue) {
            if (item.question === currentQuestion.question) {
                item.required++;
                found = true;
                break;
            }
        }
        if (!found) {
            // If current question is already a review question, update its data; else create new review record
            if (currentQuestion.fromReview) {
                if (!currentQuestion.reviewData) {
                    currentQuestion.reviewData = { required: 1, correctCount: 0 };
                } else {
                    currentQuestion.reviewData.required++;
                }
                reviewQueue.push(currentQuestion);
            } else {
                // Create a new review record from the current question
                let reviewItem = {
                    question: currentQuestion.question,
                    answer: currentQuestion.answer,
                    required: 1,
                    correctCount: 0,
                    fromReview: true
                };
                reviewQueue.push(reviewItem);
            }
        }
        setTimeout(() => {
            savePersistentReviewQueue();
            loadNextQuestion();
        }, 1000);
    }
}

// End the game: hide answer input/submit button and show endgame panel
function endGame() {
    clearInterval(timerInterval);
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    answerInput.style.display = 'none';
    submitButton.style.display = 'none';
    const avgTime = totalQuestionsAnswered > 0 ? (totalTime / totalQuestionsAnswered).toFixed(2) : 0;
    endgameMessage.textContent = `You completed ${totalQuestionsAnswered} questions in ${totalTime} seconds (average ${avgTime} seconds per question).`;
    endgamePanel.style.display = 'block';
    savePersistentReviewQueue();
}

// Start the game using configuration from window.gameConfig
function startGame() {
    if (!window.gameConfig || !Array.isArray(window.gameConfig) || window.gameConfig.length === 0) {
        console.error('No game configuration provided.');
        return;
    }
    // Reset global logs for a new game session
    totalQuestionsAnswered = 0;
    questionLog = {};
    lastQuestion = "";

    reviewQueue = loadPersistentReviewQueue();
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
