import base64
import io
import re
import tempfile
import os
from typing import Dict, List, Any, Optional
from loguru import logger
import PyPDF2
import docx
from datetime import datetime
import json

class ResumeParserService:
    def __init__(self):
        self.skills_keywords = {
            "programming_languages": [
                "python", "java", "javascript", "typescript", "c++", "c#", "php", "ruby", "go", "rust",
                "swift", "kotlin", "scala", "r", "matlab", "sql", "html", "css", "xml", "json"
            ],
            "frameworks": [
                "react", "angular", "vue", "django", "flask", "spring", "express", "node.js", "laravel",
                "rails", "asp.net", "bootstrap", "jquery", "tensorflow", "pytorch", "keras"
            ],
            "databases": [
                "mysql", "postgresql", "mongodb", "redis", "sqlite", "oracle", "sql server", "cassandra",
                "elasticsearch", "dynamodb", "firebase"
            ],
            "cloud_platforms": [
                "aws", "azure", "google cloud", "gcp", "heroku", "digitalocean", "linode", "cloudflare"
            ],
            "tools": [
                "git", "docker", "kubernetes", "jenkins", "travis", "circleci", "jira", "confluence",
                "slack", "trello", "figma", "sketch", "photoshop", "illustrator"
            ],
            "soft_skills": [
                "leadership", "communication", "teamwork", "problem solving", "analytical", "creative",
                "adaptable", "organized", "detail-oriented", "time management", "project management"
            ]
        }
        
        self.education_keywords = [
            "bachelor", "master", "phd", "doctorate", "degree", "university", "college", "institute",
            "certification", "certificate", "diploma", "gpa", "cgpa", "honors", "magna cum laude"
        ]
        
        logger.info("Resume parser service initialized")

    def health_check(self) -> Dict[str, str]:
        """Health check for resume parser service"""
        try:
            # Test basic functionality
            test_text = "Test resume parsing functionality"
            _ = self._extract_skills(test_text)
            return {"status": "healthy", "service": "resume_parser"}
        except Exception as e:
            logger.error(f"Resume parser health check failed: {e}")
            return {"status": "unhealthy", "service": "resume_parser", "error": str(e)}

    async def parse_resume(self, file_data: bytes, filename: str) -> Dict[str, Any]:
        """Parse resume file and extract structured information"""
        try:
            # Determine file type and extract text
            file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
            
            if file_extension == 'pdf':
                text = await self._extract_text_from_pdf(file_data)
            elif file_extension in ['doc', 'docx']:
                text = await self._extract_text_from_docx(file_data)
            elif file_extension == 'txt':
                text = file_data.decode('utf-8', errors='ignore')
            else:
                raise ValueError(f"Unsupported file format: {file_extension}")
            
            if not text.strip():
                raise ValueError("No text could be extracted from the resume")
            
            # Parse different sections
            parsed_data = {
                "raw_text": text,
                "contact_info": self._extract_contact_info(text),
                "skills": self._extract_skills(text),
                "experience": self._extract_experience(text),
                "education": self._extract_education(text),
                "certifications": self._extract_certifications(text),
                "projects": self._extract_projects(text),
                "summary": self._extract_summary(text),
                "achievements": self._extract_achievements(text),
                "languages": self._extract_languages(text),
                "parsing_metadata": {
                    "filename": filename,
                    "file_type": file_extension,
                    "text_length": len(text),
                    "parsed_at": datetime.now().isoformat()
                }
            }
            
            logger.info(f"Successfully parsed resume: {filename}")
            return parsed_data
            
        except Exception as e:
            logger.error(f"Resume parsing error: {e}")
            return {
                "error": str(e),
                "raw_text": "",
                "contact_info": {},
                "skills": [],
                "experience": [],
                "education": [],
                "certifications": [],
                "projects": [],
                "summary": "",
                "achievements": [],
                "languages": [],
                "parsing_metadata": {
                    "filename": filename,
                    "error": str(e),
                    "parsed_at": datetime.now().isoformat()
                }
            }


    async def _extract_text_from_pdf(self, file_data: bytes) -> str:
        """Extract text from PDF file"""
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
                temp_file.write(file_data)
                temp_file_path = temp_file.name
            
            try:
                text = ""
                with open(temp_file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    for page in pdf_reader.pages:
                        text += page.extract_text() + "\n"
                
                return text.strip()
                
            finally:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            logger.error(f"PDF text extraction error: {e}")
            raise ValueError(f"Could not extract text from PDF: {e}")

    async def _extract_text_from_docx(self, file_data: bytes) -> str:
        """Extract text from DOCX file"""
        try:
            with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as temp_file:
                temp_file.write(file_data)
                temp_file_path = temp_file.name
            
            try:
                doc = docx.Document(temp_file_path)
                text = ""
                for paragraph in doc.paragraphs:
                    text += paragraph.text + "\n"
                
                return text.strip()
                
            finally:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            logger.error(f"DOCX text extraction error: {e}")
            raise ValueError(f"Could not extract text from DOCX: {e}")

    def _extract_contact_info(self, text: str) -> Dict[str, Any]:
        """Extract contact information"""
        try:
            contact_info = {}
            
            # Email extraction
            email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
            emails = re.findall(email_pattern, text)
            if emails:
                contact_info["email"] = emails[0]
            
            # Phone number extraction
            phone_pattern = r'\+?\d[\d\s\-]{8,15}'
            phones = re.findall(phone_pattern, text)

            if phones:
                contact_info["phone"] = phones[0]
            
            # LinkedIn extraction
            linkedin_pattern = r'linkedin\.com/in/[\w-]+'
            linkedin_matches = re.findall(linkedin_pattern, text, re.IGNORECASE)
            if linkedin_matches:
                contact_info["linkedin"] = f"https://{linkedin_matches[0]}"
            
            # GitHub extraction
            github_pattern = r'github\.com/[\w-]+'
            github_matches = re.findall(github_pattern, text, re.IGNORECASE)
            if github_matches:
                contact_info["github"] = f"https://{github_matches[0]}"
            
            # Name extraction (simple heuristic - first line that looks like a name)
            lines = text.split('\n')
            for line in lines[:5]:  # Check first 5 lines
                line = line.strip()
                if line and len(line.split()) <= 4 and not any(char.isdigit() for char in line):
                    if not any(keyword in line.lower() for keyword in ['email', 'phone', 'address', 'linkedin']):
                        contact_info["name"] = line
                        break
            
            return contact_info
            
        except Exception as e:
            logger.error(f"Contact info extraction error: {e}")
            return {}

    def _extract_skills(self, text: str) -> List[Dict[str, Any]]:
        """Extract skills from resume text"""
        try:
            text_lower = text.lower()
            found_skills = []
            
            for category, skills_list in self.skills_keywords.items():
                category_skills = []
                for skill in skills_list:
                    if skill.lower() in text_lower:
                        category_skills.append(skill)
                
                if category_skills:
                    found_skills.append({
                        "category": category.replace("_", " ").title(),
                        "skills": category_skills
                    })
            
            # Also look for skills in dedicated skills section
            skills_section = self._find_section(text, ["skills", "technical skills", "core competencies"])
            if skills_section:
                additional_skills = self._extract_skills_from_section(skills_section)
                if additional_skills:
                    found_skills.append({
                        "category": "Additional Skills",
                        "skills": additional_skills
                    })
            
            return found_skills
            
        except Exception as e:
            logger.error(f"Skills extraction error: {e}")
            return []

    def _extract_experience(self, text: str) -> List[Dict[str, Any]]:
        """Extract work experience"""
        try:
            experience = []
            
            # Look for experience section
            exp_section = self._find_section(text, [
                "experience", "work experience", "professional experience", 
                "employment", "career history", "work history"
            ])
            
            if not exp_section:
                return []
            
            # Split by common job separators
            job_entries = re.split(r'\n(?=\w.*\|\s)', exp_section)
            
            for entry in job_entries:
                if len(entry.strip()) < 20:  # Skip very short entries
                    continue
                
                job_info = self._parse_job_entry(entry)
                if job_info:
                    experience.append(job_info)
            
            return experience
            
        except Exception as e:
            logger.error(f"Experience extraction error: {e}")
            return []

    def _extract_education(self, text: str) -> List[Dict[str, Any]]:
        """Extract education information"""
        try:
            education = []
            
            # Look for education section
            edu_section = self._find_section(text, [
                "education", "academic background", "qualifications", "academic qualifications"
            ])
            
            if not edu_section:
                return []
            
            # Look for degree patterns
            degree_pattern = r'(Bachelor[^,\n]*|Master[^,\n]*|B\.Tech[^,\n]*|M\.Tech[^,\n]*)'
            degrees = re.findall(degree_pattern, edu_section, re.IGNORECASE)
            
            for degree in degrees:
                edu_info = {
                    "degree": degree.strip(),
                    "institution": "",
                    "year": "",
                    "gpa": ""
                }
                
                # Try to find institution and year in the same line or nearby
                degree_line = self._find_line_containing(edu_section, degree)
                if degree_line:
                    # Extract year
                    year_pattern = r'(19|20)\d{2}'
                    years = re.findall(year_pattern, degree_line)
                    if years:
                        edu_info["year"] = years[-1]  # Take the latest year
                    
                    # Extract GPA
                    gpa_pattern = r'GPA:?\s*(\d+\.?\d*)'
                    gpa_match = re.search(gpa_pattern, degree_line, re.IGNORECASE)
                    if gpa_match:
                        edu_info["gpa"] = gpa_match.group(1)
                
                education.append(edu_info)
            
            return education
            
        except Exception as e:
            logger.error(f"Education extraction error: {e}")
            return []

    def _extract_certifications(self, text: str) -> List[str]:
        """Extract certifications"""
        try:
            certifications = []
            
            # Look for certifications section
            cert_section = self._find_section(text, [
                "certifications", "certificates", "professional certifications", "licenses"
            ])
            
            if cert_section:
                # Split by lines and filter
                lines = cert_section.split('\n')
                for line in lines:
                    line = line.strip()
                    if line and len(line) > 5 and not line.lower().startswith('certification'):
                        certifications.append(line)
            
            # Also look for common certification patterns throughout the text
            cert_patterns = [
                r'AWS Certified[^,\n]*',
                r'Google Cloud[^,\n]*',
                r'Microsoft Certified[^,\n]*',
                r'Cisco[^,\n]*',
                r'PMP[^,\n]*',
                r'Scrum Master[^,\n]*'
            ]
            
            for pattern in cert_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                certifications.extend(matches)
            
            return list(set(certifications))  # Remove duplicates
            
        except Exception as e:
            logger.error(f"Certifications extraction error: {e}")
            return []

    def _extract_projects(self, text: str) -> List[Dict[str, Any]]:
        """Extract project information"""
        try:
            projects = []
            
            # Look for projects section
            proj_section = self._find_section(text, [
                "projects", "personal projects", "key projects", "notable projects"
            ])
            
            if proj_section:
                # Split by project separators
                project_entries = re.split(r'\n(?=[A-Z][^a-z]*:|\d+\.)', proj_section)
                
                for entry in project_entries:
                    if len(entry.strip()) < 20:
                        continue
                    
                    lines = entry.strip().split('\n')
                    if lines:
                        project_info = {
                            "title": lines[0].strip(),
                            "description": ' '.join(lines[1:]).strip() if len(lines) > 1 else ""
                        }
                        projects.append(project_info)
            
            return projects
            
        except Exception as e:
            logger.error(f"Projects extraction error: {e}")
            return []

    def _extract_summary(self, text: str) -> str:
        """Extract professional summary"""
        try:
            # Look for summary section
            summary_section = self._find_section(text, [
                "summary", "professional summary", "profile", "objective", 
                "career objective", "about me", "overview"
            ])
            
            if summary_section:
                # Clean up the summary
                summary = summary_section.strip()
                # Remove section headers
                summary = re.sub(r'^(summary|professional summary|profile|objective)[:\s]*', '', summary, flags=re.IGNORECASE)
                return summary.strip()
            
            return ""
            
        except Exception as e:
            logger.error(f"Summary extraction error: {e}")
            return ""

    def _extract_achievements(self, text: str) -> List[str]:
        """Extract achievements and accomplishments"""
        try:
            achievements = []
            
            # Look for achievements section
            ach_section = self._find_section(text, [
                "achievements", "accomplishments", "awards", "honors", "recognition"
            ])
            
            if ach_section:
                lines = ach_section.split('\n')
                for line in lines:
                    line = line.strip()
                    if line and len(line) > 10:
                        # Remove bullet points and numbering
                        line = re.sub(r'^[\•\-\*\d+\.\)]\s*', '', line)
                        if line:
                            achievements.append(line)
            
            return achievements
            
        except Exception as e:
            logger.error(f"Achievements extraction error: {e}")
            return []

    def _extract_languages(self, text: str) -> List[Dict[str, str]]:
        """Extract language skills"""
        try:
            languages = []
            
            # Look for languages section
            lang_section = self._find_section(text, [
                "languages", "language skills", "linguistic skills"
            ])
            
            if lang_section:
                # Common language patterns
                lang_pattern = r'(English|Spanish|French|German|Chinese|Japanese|Korean|Arabic|Portuguese|Italian|Russian|Hindi|Dutch|Swedish|Norwegian|Danish)[^,\n]*'
                lang_matches = re.findall(lang_pattern, lang_section, re.IGNORECASE)
                
                for match in lang_matches:
                    # Try to extract proficiency level
                    proficiency = "Unknown"
                    if any(level in match.lower() for level in ['native', 'fluent', 'advanced', 'intermediate', 'basic', 'beginner']):
                        for level in ['native', 'fluent', 'advanced', 'intermediate', 'basic', 'beginner']:
                            if level in match.lower():
                                proficiency = level.title()
                                break
                    
                    languages.append({
                        "language": match.split()[0],  # First word is usually the language name
                        "proficiency": proficiency
                    })
            
            return languages
            
        except Exception as e:
            logger.error(f"Languages extraction error: {e}")
            return []

    def _find_section(self, text: str, section_names: List[str]) -> str:
        """Find a section of resume text"""
        try:
            pattern = r'(?i)(' + '|'.join(section_names) + r')\s*\n(.*?)(?=\n[A-Z\s]{3,}\n|\Z)'
            match = re.search(pattern, text, re.DOTALL)

            if match:
                return match.group(2).strip()

            return ""

        except Exception as e:
            logger.error(f"Section finding error: {e}")
            return ""

    def _find_line_containing(self, text: str, substring: str) -> str:
        """Find the line containing a specific substring"""
        lines = text.split('\n')
        for line in lines:
            if substring.lower() in line.lower():
                return line.strip()
        return ""

    def _extract_skills_from_section(self, skills_text: str) -> List[str]:
        """Extract individual skills from skills section text"""
        try:
            # Split by common separators
            skills = re.split(r',|\n|•', skills_text)
            
            # Clean and filter skills
            cleaned_skills = []
            for skill in skills:
                skill = skill.strip()
                if skill and len(skill) > 1 and len(skill) < 50:
                    # Remove common prefixes
                    skill = re.sub(r'^(proficient in|experience with|knowledge of)\s*', '', skill, flags=re.IGNORECASE)
                    cleaned_skills.append(skill)
            
            return cleaned_skills
            
        except Exception as e:
            logger.error(f"Skills section extraction error: {e}")
            return []

    def _parse_job_entry(self, entry: str) -> Optional[Dict[str, Any]]:
        """Parse a single job entry"""
        try:
            lines = [line.strip() for line in entry.split('\n') if line.strip()]
            
            if not lines:
                return None
            
            job_info = {
                "title": "",
                "company": "",
                "duration": "",
                "description": ""
            }
            
            # First line usually contains title and company
            first_line = lines[0]
            
            # Try to separate title and company
            if ' at ' in first_line:
                parts = first_line.split(' at ', 1)
                job_info["title"] = parts[0].strip()
                job_info["company"] = parts[1].strip()
            elif ' - ' in first_line:
                parts = first_line.split(' - ', 1)
                job_info["title"] = parts[0].strip()
                job_info["company"] = parts[1].strip()
            else:
                job_info["title"] = first_line
            
            # Look for dates in the next few lines
            for line in lines[1:4]:
                date_pattern = r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}/|\d{4})'
                if re.search(date_pattern, line, re.IGNORECASE):
                    job_info["duration"] = line
                    break
            
            # Rest is description
            desc_lines = []
            for line in lines[1:]:
                if not job_info["duration"] or line != job_info["duration"]:
                    desc_lines.append(line)
            
            job_info["description"] = ' '.join(desc_lines)
            
            return job_info if job_info["title"] else None
            
        except Exception as e:
            logger.error(f"Job entry parsing error: {e}")
            return None