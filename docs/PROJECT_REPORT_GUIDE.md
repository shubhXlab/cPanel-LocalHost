# Academic Project Report Guide & Content Reference

**Project Title:** cPanel Localhost & Modern Web Hosting Control Panel with Autonomous AI Integration  
**Candidate Name:** Shubham Ramjiyani  
**Class:** S.Y. BBA (Computer Applications) &bull; Semester IV  
**Roll No:** 52  
**Subject:** Project (Core Practical)  
**Institution:** Ashoka Center for Business and Computer Studies (ACBCS), Nashik  
**Academic Year:** 2025 &ndash; 2026  

---

## 1. Executive Summary / Abstract

Web hosting control panels like cPanel & WHM, Plesk, and DirectAdmin are industry-standard tools for deploying web applications, configuring databases, creating DNS records, and managing file structures. However, commercial licenses for cPanel cost \$20 to \$60+ monthly, and typical local testing environments like default XAMPP or WampServer lack real multi-domain virtual hosts, modern web interfaces, automated backup generators, chrooted file managers, cron job schedulers, and programmatic REST or AI-driven APIs.

**cPanel Localhost** is an enterprise-grade, browser-based web hosting control panel developed on a high-concurrency Node.js architecture. It replicates the authentic cPanel Jupiter design while orchestrating underlying local services (Apache HTTP Server, MariaDB/MySQL, MultiPHP). Furthermore, it pioneers an **Autonomous AI Agent Integration Suite**, enabling artificial intelligence models (such as ChatGPT Custom GPT Actions, Anthropic Claude, Cursor, and LangChain) to programmatically manage files, run databases, configure DNS, and trigger background tasks via native Bearer API tokens, OpenAPI 3.0 specifications, and authentic cPanel UAPI protocols.

---

## 2. Motivation

1. **High Cost of Cloud cPanel Licenses for Learning & Development**:
   Students, independent developers, and small agencies frequently struggle to practice and test production cPanel workflows locally without paying expensive monthly cloud hosting licenses.
2. **Shortcomings of Traditional Local Stacks (XAMPP / WampServer)**:
   Traditional desktop GUI panels like XAMPP Control Panel are static Windows utilities that lack a web-based dashboard, role-based access, automated virtual host generators, cron scheduling, terminal emulation, or audit logging.
3. **The Rise of Autonomous AI & Agentic Workflows**:
   Modern developers are using AI assistants to build applications. However, AI agents cannot deploy or manage servers without structured APIs. Introducing native API Tokens, OpenAPI 3.0 schemas, and an AI Execution Gateway bridges the gap between AI development and real hosting infrastructure.
4. **Practical Application of BBA(CA) Curriculum**:
   Demonstrating mastery over Full-Stack Web Development, Relational Database Engineering, Computer Networks, Operating System Administration, and Application Security in a unified capstone project.

---

## 3. Problem Statement

> *"To design, engineer, and deploy a secure, high-performance, and modular Localhost Web Hosting Control Panel that faithfully mirrors the authentic cPanel Jupiter interface and functionality—providing complete browser-based administration for File Management, MariaDB/MySQL databases, Apache Virtual Hosts, DNS records, Linux-compatible Cron Jobs, SSL/TLS, and Server Metrics, while equipping the platform with an OpenAPI-compliant REST & UAPI gateway allowing autonomous AI agents to execute server operations seamlessly."*

---

## 4. Objectives & Goals

- **Faithful Interface & Ergonomics**: Recreate the cPanel Jupiter desktop dashboard with responsive categories, modal dialogues, toast notifications, search filters, and status badges.
- **File System Management with Security Chroot**: Provide a secure browser-based File Manager with directory tree navigation, in-browser code editor, file uploaders, ZIP extraction/compression, and traversal attack prevention (`chroot jail`).
- **Database Orchestration**: Enable creating and dropping MySQL databases, managing database users, and assigning granular SQL privileges via real connection pooling.
- **Domain & Virtual Host Automation**: Automate Apache `httpd-vhosts.conf` generation and DNS Zone Editor records (`A`, `CNAME`, `MX`, `TXT`) without manual config file edits.
- **Advanced Diagnostic & Automation Tools**: Provide standard 5-part Linux cron syntax scheduling with immediate execution capture, custom HTTP error page generation (`400`, `401`, `403`, `404`, `500`) with `.htaccess` synchronization, and live ICMP Ping / DNS diagnostics.
- **Personal Access Tokens & AI Gateway**: Build an authentic cPanel **Manage API Tokens** security suite with SHA-256 token hashing, custom permission scopes, CSRF exemption for programmatic requests, OpenAPI 3.0 discovery, and a single-tool universal execution gateway (`/api/ai/execute`).

---

## 5. Scope of the Project

- **Target Audience**: Developers, students, web designers, testing engineers, and AI agent developers needing a real local cPanel server.
- **Supported Environment**: Windows 10/11 running local Apache 2.4, MariaDB 10.4+, and Node.js v18+.
- **Extensibility**: Modular REST architecture allowing future expansion into containerized Docker environments, multi-server WHM reseller clustering, and mail transfer agents (Postfix/Dovecot).

---

## 6. Table of Contents / Index Structure

The Table of Contents for the printed report is structured into 9 comprehensive chapters:

- **Preliminary Pages**: Certificate of Approval (i), Declaration (ii), Acknowledgement (iii), Executive Summary (iv)
- **Chapter 1: Introduction & Project Background** (Pages 01–05)
  - 1.1 Introduction, 1.2 Motivation, 1.3 Problem Statement, 1.4 Objectives, 1.5 Scope
- **Chapter 2: Literature Review & Feasibility Analysis** (Pages 06–11)
  - Existing systems comparison, limitations, feasibility study (technical, operational, economic)
- **Chapter 3: System Requirements & Architecture Design** (Pages 12–18)
  - Hardware/software environment, 3-tier architecture, CSRF protection, chroot security model
- **Chapter 4: System Analysis & Modeling (UML & DFD)** (Pages 19–26)
  - Use case diagrams, DFD Level 0 and Level 1, ER diagrams, state machine flows
- **Chapter 5: Detailed Module Implementation & Engineering** (Pages 27–46)
  - Jupiter UI, File Manager, MySQL orchestrator, Domains & DNS, Cron Jobs, SSL, MultiPHP, API Tokens & UAPI
- **Chapter 6: AI Integration & Function Calling Subsystem** (Pages 47–54)
  - OpenAPI 3.0.3 spec, OpenAI/Claude tool schemas, Universal AI Gateway, Custom GPT Actions
- **Chapter 7: Software Testing, Verification & Security Audits** (Pages 55–61)
  - Test suites, automated verification matrix, CSRF bypass verification, 100% pass rate
- **Chapter 8: User Interface Walkthrough & System Screenshots** (Pages 62–70)
  - Complete pictorial walkthrough of all cPanel modules and dialogues
- **Chapter 9: Conclusion, Limitations & Future Scope** (Pages 71–74)
  - Key accomplishments, constraints, future development
- **References & Academic Bibliography** (Pages 75–77)

---

## 7. How to View & Print Pages

Both the Cover Page and Index Page are accessible through your browser:

1. **Cover Page**: [http://localhost:2083/cover_page.html](http://localhost:2083/cover_page.html)
2. **Table of Contents / Index**: [http://localhost:2083/index_page.html](http://localhost:2083/index_page.html)
3. **Print / Export PDF**: Open either page and press **`Ctrl + P`**, set Margins to **None**, and choose **Save as PDF**.
