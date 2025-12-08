import { KbService } from './kb/kb.service.js';

async function verify() {
    console.log('--- STARTING KB VERIFICATION ---\n');
    const kb = new KbService();

    // 1. Test Branches
    console.log('1. Testing getBranches("escalón"):');
    const branches = kb.getBranches('escalón');
    console.log(JSON.stringify(branches, null, 2));
    console.log('\n');

    // 2. Test Exam Info
    console.log('2. Testing getExamInfo("hemograma"):');
    const exams = kb.getExamInfo('hemograma');
    console.log(JSON.stringify(exams, null, 2));
    console.log('\n');

    // 3. Test FAQ
    console.log('3. Testing getFAQ("ayuno"):');
    const faqs = kb.getFAQ('ayuno');
    console.log(JSON.stringify(faqs, null, 2));
    console.log('\n');

    // 4. Test General Search
    console.log('4. Testing searchKnowledge("ultrasonido"):');
    const search = kb.searchKnowledge('ultrasonido');
    console.log(JSON.stringify(search, null, 2));
    console.log('\n');

    console.log('--- VERIFICATION COMPLETE ---');
}

verify().catch(console.error);
