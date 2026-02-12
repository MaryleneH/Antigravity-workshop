from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    books = [
        {
            "title": "The Duke's Secret",
            "genre": "Historical Romance",
            "desc": "In the misty gardens of Regency England, a forbidden love blooms.",
            "color": "linear-gradient(135deg, #2c3e50, #bdc3c7)" # Placeholder gradient
        },
        {
            "title": "Starlight Oath",
            "genre": "Fantasy Romance",
            "desc": "A warrior and a mage bound by destiny under the silver moon.",
            "color": "linear-gradient(135deg, #4b0082, #e6e6fa)" # Placeholder gradient
        },
        {
            "title": "Midnight in Paris",
            "genre": "Contemporary Romance",
            "desc": "Two strangers, one city of lights, and a chance encounter that changes everything.",
            "color": "linear-gradient(135deg, #c0392b, #f1c40f)" # Placeholder gradient
        }
    ]
    return render_template('index.html', books=books)

if __name__ == '__main__':
    app.run(debug=True)
