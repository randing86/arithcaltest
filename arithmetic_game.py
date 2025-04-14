import time
import random
import sys
import json

REVIEW_LOG_FILE = 'review_log.txt'


def randomInt(min_val, max_val):
    """Return a random integer between min_val and max_val inclusive."""
    return random.randint(min_val, max_val)


def load_review_log():
    """Load persistent review questions from a file. Returns a list of review items."""
    try:
        with open(REVIEW_LOG_FILE, 'r') as f:
            data = json.load(f)
            return data
    except Exception:
        return []


def save_review_log(review_list):
    """Save persistent review questions to a file."""
    try:
        with open(REVIEW_LOG_FILE, 'w') as f:
            json.dump(review_list, f)
    except Exception as e:
        print(f"Error saving review log: {e}")


# Configuration: ask user for phase details
# Updated to allow toggling between specific and range in a single prompt

def configure_game():
    phases = []
    while True:
        try:
            num_phases = int(input("Enter number of phases (1-3): "))
            if 1 <= num_phases <= 3:
                break
            else:
                print("Please enter a number between 1 and 3.")
        except ValueError:
            print("Invalid input. Please enter an integer.")

    for i in range(1, num_phases + 1):
        print(f"\n--- Configuring Phase {i} ---")
        phase = {}
        # For first number: ask type
        while True:
            first_type = input(f"Phase {i}: Enter 's' for specific first number or 'r' for range: ").strip().lower()
            if first_type in ['s', 'r']:
                break
            else:
                print("Please enter 's' or 'r'.")
        if first_type == 's':
            while True:
                try:
                    value = int(input("Enter the specific first number (0-100): "))
                    if 0 <= value <= 100:
                        phase['firstSpecific'] = value
                        break
                    else:
                        print("Number must be between 0 and 100.")
                except ValueError:
                    print("Invalid input. Please enter an integer.")
        else:
            while True:
                try:
                    maximum = int(input("Enter the maximum for first number (0-100): "))
                    if 0 <= maximum <= 100:
                        phase['firstNum'] = maximum
                        break
                    else:
                        print("Number must be between 0 and 100.")
                except ValueError:
                    print("Invalid input. Please enter an integer.")

        # For second number
        while True:
            second_type = input(f"Phase {i}: Enter 's' for specific second number or 'r' for range: ").strip().lower()
            if second_type in ['s', 'r']:
                break
            else:
                print("Please enter 's' or 'r'.")
        if second_type == 's':
            while True:
                try:
                    value = int(input("Enter the specific second number (0-100): "))
                    if 0 <= value <= 100:
                        phase['secondSpecific'] = value
                        break
                    else:
                        print("Number must be between 0 and 100.")
                except ValueError:
                    print("Invalid input. Please enter an integer.")
        else:
            while True:
                try:
                    maximum = int(input("Enter the maximum for second number (0-100): "))
                    if 0 <= maximum <= 100:
                        phase['secondNum'] = maximum
                        break
                    else:
                        print("Number must be between 0 and 100.")
                except ValueError:
                    print("Invalid input. Please enter an integer.")

        # Operation
        while True:
            op = input("Enter the operation (+, -, *, /): ").strip()
            if op in ['+', '-', '*', '/']:
                phase['operation'] = op
                break
            else:
                print("Invalid operation. Please enter one of +, -, *, /.")

        # Limit type
        while True:
            print("Choose limit type:")
            print("1. Fixed number of questions")
            print("2. Time limit in seconds")
            choice = input("Enter 1 or 2: ").strip()
            if choice == '1':
                phase['limitType'] = 'questions'
                while True:
                    try:
                        q_limit = int(input("Enter the number of questions for this phase: "))
                        if q_limit > 0:
                            phase['limit'] = q_limit
                            break
                        else:
                            print("Must be greater than 0.")
                    except ValueError:
                        print("Invalid input. Please enter an integer.")
                break
            elif choice == '2':
                phase['limitType'] = 'time'
                while True:
                    try:
                        t_limit = int(input("Enter the time limit (in seconds) for this phase: "))
                        if t_limit > 0:
                            phase['limit'] = t_limit
                            break
                        else:
                            print("Must be greater than 0.")
                    except ValueError:
                        print("Invalid input. Please enter an integer.")
                break
            else:
                print("Please choose either 1 or 2.")

        # Allow negative results
        phase['allowNegative'] = input("Allow negative results? (y/n): ").strip().lower() == 'y'

        phases.append(phase)
    return phases


def generate_question(config):
    """Generate an arithmetic question based on phase configuration."""
    if 'firstSpecific' in config:
        num1 = config['firstSpecific']
    else:
        num1 = randomInt(0, config['firstNum'])
    
    if 'secondSpecific' in config:
        num2 = config['secondSpecific']
    else:
        # For division, avoid zero if possible
        if config['operation'] == '/' and config.get('secondNum', 0) == 0:
            num2 = 1
        else:
            num2 = randomInt(0 if config['operation'] != '/' else 1, config['secondNum'])

    op = config['operation']
    if op == '+':
        answer = num1 + num2
        question = f"What is {num1} + {num2}?"
    elif op == '-':
        # Ensure non-negative if not allowed
        if not config['allowNegative'] and num1 < num2:
            num1, num2 = num2, num1
        answer = num1 - num2
        question = f"What is {num1} - {num2}?"
    elif op == '*':
        answer = num1 * num2
        question = f"What is {num1} * {num2}?"
    elif op == '/':
        if num2 == 0:
            num2 = 1
        if 'firstSpecific' in config:
            num1 = num1 - (num1 % num2)
        else:
            max_quotient = config.get('firstNum', 100) // num2
            quotient = randomInt(0, max_quotient) if max_quotient > 0 else 0
            num1 = quotient * num2
        answer = num1 // num2
        question = f"What is {num1} / {num2}? (Provide the integer quotient)"
    else:
        answer = num1 + num2
        question = f"What is {num1} + {num2}?"
    return question, answer


def ask_question(prompt, correct_answer):
    """Prompt the user until they get the answer correct, counting wrong attempts."""
    wrong_attempts = 0
    while True:
        user_input = input(prompt + "\nYour answer: ")
        try:
            user_ans = int(user_input.strip())
        except ValueError:
            print("Please enter a valid integer answer.")
            continue
        if user_ans == correct_answer:
            print(f"Correct! You answered: {user_ans}\n")
            return wrong_attempts
        else:
            wrong_attempts += 1
            print(f"Incorrect, you answered: {user_ans}. This problem will be reviewed later.\n")


def run_phase(phase_config, phase_number, overall_start):
    print("\n\n--- Phase {} ---\n".format(phase_number))
    review_queue = []
    # For questions mode
    if phase_config['limitType'] == 'questions':
        total = phase_config['limit']
        for q in range(1, total + 1):
            overall_elapsed = int(time.time() - overall_start)
            question_prompt = f"({overall_elapsed} sec elapsed) Question {q}:"
            question_text, answer = generate_question(phase_config)
            # Display page break is already done by printing newlines above
            # Bold formatting using ANSI escape codes if supported
            print(f"\033[1m{question_text}\033[0m")
            wrong = ask_question(question_prompt, answer)
            if wrong > 0:
                # Add to review queue with required repetitions equal to wrong attempts
                review_queue.append({'question': question_text, 'answer': answer, 'required': wrong, 'correctCount': 0})
    else:
        # Time mode
        limit = phase_config['limit']
        q = 0
        phase_start = time.time()
        while True:
            elapsed = int(time.time() - phase_start)
            if elapsed >= limit:
                break
            q += 1
            overall_elapsed = int(time.time() - overall_start)
            question_prompt = f"({overall_elapsed} sec elapsed) Question {q}:"
            question_text, answer = generate_question(phase_config)
            print(f"\033[1m{question_text}\033[0m")
            wrong = ask_question(question_prompt, answer)
            if wrong > 0:
                review_queue.append({'question': question_text, 'answer': answer, 'required': wrong, 'correctCount': 0})
    
    # Process review questions until all are mastered
    if review_queue:
        print("\nReview Round for Phase {}:\n".format(phase_number))
    while review_queue:
        for item in review_queue[:]:
            overall_elapsed = int(time.time() - overall_start)
            prompt = f"({overall_elapsed} sec elapsed) Review:"
            print(f"\033[1m{item['question']}\033[0m")
            wrong = ask_question(prompt, item['answer'])
            # If answered correctly, increment correct count
            item['correctCount'] += 1
            if item['correctCount'] >= item['required']:
                review_queue.remove(item)
    print(f"--- Completed Phase {phase_number} ---\n")


def end_menu(overall_start):
    total_time = int(time.time() - overall_start)
    print(f"Congratulations! You completed the game in {total_time} seconds.")
    while True:
        choice = input("Enter 'r' to restart or 'q' to quit: ").strip().lower()
        if choice == 'r':
            main()
            break
        elif choice == 'q':
            print("Goodbye!")
            # Before quitting, save persistent review log
            persistent_reviews = load_review_log()
            # Append any remaining review questions (this simplistic approach: just append current session reviews)
            # In this implementation, review questions have already been mastered, so we clear the log
            save_review_log([])
            sys.exit(0)
        else:
            print("Invalid input. Please enter 'r' or 'q'.")


def main():
    print("Welcome to the Arithmetic Game!\n")
    phases_config = configure_game()
    # Load persistent review questions from previous sessions
    persistent_reviews = load_review_log()
    overall_start = time.time()
    phase_number = 1
    for config in phases_config:
        run_phase(config, phase_number, overall_start)
        phase_number += 1
    # After main phases, include persistent review questions if any
    if persistent_reviews:
        print("\nReview Round for Persistent Problems:\n")
        while persistent_reviews:
            for item in persistent_reviews[:]:
                overall_elapsed = int(time.time() - overall_start)
                prompt = f"({overall_elapsed} sec elapsed) Persistent Review:"
                print(f"\033[1m{item['question']}\033[0m")
                wrong = ask_question(prompt, item['answer'])
                item['correctCount'] += 1
                if item['correctCount'] >= item['required']:
                    persistent_reviews.remove(item)
        save_review_log(persistent_reviews)
    end_menu(overall_start)


if __name__ == "__main__":
    main()
