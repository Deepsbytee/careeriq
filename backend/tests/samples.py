"""Realistic sample documents used by the tests."""

STRONG_RESUME = """Priya Sharma
Bengaluru, Karnataka | priya.sharma@example.com | +91 98765 43210
linkedin.com/in/priya-sharma | github.com/priya-sharma

SUMMARY
Final-year computer science student with hands-on experience building and deploying full-stack web applications.

EDUCATION
B.E. Computer Science and Engineering, K S School of Engineering, Bengaluru
2023 - 2027 | CGPA: 8.94

SKILLS
Python, JavaScript, TypeScript, React, Node.js, FastAPI, Django, PostgreSQL, MongoDB, Docker, Git, GitHub Actions, REST APIs, JWT, Data Structures, Algorithms

EXPERIENCE
Software Development Intern, Oasis Infobyte
Jun 2025 - Jul 2025
• Built 6 REST API endpoints with FastAPI and PostgreSQL, cutting average response time by 35%.
• Developed 4 reusable React components used across 3 internal dashboards.
• Automated deployment with GitHub Actions, reducing release time from 40 minutes to 8 minutes.
• Wrote 25 unit tests that raised backend coverage to 82%.

PROJECTS
TaskFlow - Team task manager
• Designed JWT authentication and role-based access control for 3 user roles.
• Implemented real-time updates for 50+ concurrent users using WebSockets.
• Containerized the app with Docker and deployed it to a cloud VM.
CareerIQ - Resume analyser
• Created a hybrid scoring engine that combines rule-based checks with AI feedback.
• Integrated the GitHub API to score 100+ repositories per profile.

ACHIEVEMENTS
• Solved 300+ problems on LeetCode.
• Finalist, college hackathon 2025 (top 10 of 120 teams).
"""

WEAK_RESUME = """Rahul
rahul at gmail

I am a hard-working team player looking for a job. I am responsible for many things.

Education
BCA 2022

Skills
Computer, MS Word, Internet, communication, hardworking, team player, results-oriented, self-motivated.

Experience
I worked on various tasks at a shop and helped with customers and I did my best to help everyone every day in many ways.
Responsible for handling things in the office during the day and I worked on different jobs.
"""

INVOICE = """INVOICE #20931
Bill To: Acme Traders Pvt Ltd, 12 MG Road, Bengaluru
Invoice date: 12 March 2026    Due date: 26 March 2026
Description            Qty    Unit price    Amount
Laptop stand            4      1,250         5,000
USB-C hub               2      2,100         4,200
Subtotal                                     9,200
GST 18%                                      1,656
Total due                                   10,856
Amount due within 14 days of the invoice date. Late payment attracts 2% interest per month.
Terms and conditions apply. Purchase order reference must be quoted on all correspondence.
Payment can be made by bank transfer to the account listed below. Please include the invoice number
as the payment reference so that we can allocate your payment correctly. For queries contact accounts.
""" + "Thank you for your business. " * 12

RESEARCH_PAPER = (
    "A Study of Convolutional Networks for Crop Disease Detection\n"
    "Abstract\n"
    "This paper presents a methodology for detecting crop disease using convolutional neural networks. "
    "We test the hypothesis that transfer learning improves accuracy on small agricultural datasets [1]. "
    "Keywords: deep learning, agriculture, classification\n"
    "1. Introduction\n"
)
RESEARCH_PAPER += (
    "Crop diseases cause significant yield losses worldwide and early detection remains a major challenge for "
    "smallholder farmers who lack access to expert agronomists and laboratory facilities, as discussed by Singh et al. [2]. "
    "In this literature review we summarise prior approaches before presenting our own methodology in detail, "
    "followed by an evaluation of results across three datasets with a discussion of limitations and future work. " * 6
)
RESEARCH_PAPER += "\nReferences\n[1] Singh et al., 2021. doi:10.1000/xyz123\n[2] Rao et al., 2022. doi:10.1000/abc456\n"

LOREM = ("Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et "
         "dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip. ") * 10

JOB_DESCRIPTION = """Backend Engineer - Bengaluru
About the role
We are looking for a Backend Engineer to join our platform team. You will design and build scalable APIs.
Responsibilities include building REST services, writing tests, and improving reliability.
Requirements
- 2+ years of experience with Python and FastAPI or Django
- Strong knowledge of PostgreSQL and Redis
- Experience with Docker and Kubernetes on AWS
Nice to have: Kafka, Terraform, CI/CD pipelines.
Apply now. We are an equal opportunity employer.
"""

# A real-looking resume whose bullets are mostly weak: no figures, filler openings.
WEAK_BULLETS_RESUME = """Arjun Mehta
Pune, Maharashtra | arjun.mehta@example.com | +91 91234 56789
github.com/arjun-mehta

EDUCATION
B.Tech Information Technology, Pune Institute of Technology
2022 - 2026 | CGPA: 8.1

SKILLS
Python, Django, MySQL, Git, HTML, CSS

EXPERIENCE
Web Development Intern, Brightside Labs
Jun 2025 - Aug 2025
• Responsible for working on the backend of the company website.
• Worked on various features and helped with testing.
• Helped with bug fixing in the Django application.
• Created pages for the admin panel.
• Built a REST API for orders that handled 200 requests per minute.

PROJECTS
Library Manager
• Made a system to manage books and members.
• Worked on login and registration pages.
• Developed a search feature for the catalogue.
"""

# Covers some of the JOB_DESCRIPTION skills.
MEDIUM_RESUME = """Sneha Iyer
Chennai | sneha.iyer@example.com | 98765 12345
linkedin.com/in/sneha-iyer

SUMMARY
Backend-leaning developer with two internships.

EDUCATION
B.E. Computer Science, Anna University, 2021 - 2025

SKILLS
Python, Flask, MongoDB, Docker, Git, Linux

EXPERIENCE
Backend Intern, DataNest
Jan 2025 - Jun 2025
• Built 4 Flask endpoints and reduced report generation time by 30%.
• Containerized two services with Docker for easier deployment.
• Wrote 15 unit tests for the billing module.

PROJECTS
Expense Tracker
• Designed a REST API with Flask and MongoDB used by 40 classmates.
• Added JWT login and role-based access.
"""
