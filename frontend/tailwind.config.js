/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#FF9900", // AWS Orange
                "primary-hover": "#ec8c00",
                "aws-squid-ink": "#232f3e",
                "aws-dark-blue": "#161e2d",
                "aws-sky": "#0073bb",
                "aws-sky-hover": "#006db1",
                "aws-orange": "#ff9900",
                "aws-orange-hover": "#ec8c00",
                "aws-gray": "#f2f3f3",
                "aws-border": "#d5dbdb",
                "aws-text": "#16191f",
                "aws-text-secondary": "#545b64",
            },
            fontFamily: {
                sans: ['"Amazon Ember"', 'Helvetica', 'Arial', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
