/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                pomegranate: {
                    950: '#2f0205', // Deep background
                    900: '#4a0404',
                    800: '#8d0801',
                    600: '#d90429',
                    500: '#ef233c', // Bright highlight
                },
                seed: {
                    100: '#edf2f4', // Off-white/Cream
                    200: '#8d99ae',
                },
                gold: {
                    500: '#ffb703', // Luxury accent
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            animation: {
                'spin-slow': 'spin 20s linear infinite',
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }
        },
    },
    plugins: [],
}
