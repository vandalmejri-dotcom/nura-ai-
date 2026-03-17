const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing DB connection and schema...');
        const setCount = await prisma.studySet.count();
        console.log('StudySet count:', setCount);
        
        const firstSet = await prisma.studySet.findFirst();
        if (firstSet) {
            console.log('First set ID:', firstSet.id);
            console.log('Columns found:', Object.keys(firstSet));
            console.log('Can access flashcards?', 'flashcards' in firstSet);
            console.log('Can access quiz?', 'quiz' in firstSet);
            console.log('Can access fillInTheBlanks?', 'fillInTheBlanks' in firstSet);
            console.log('Can access synthesizedNotes?', 'synthesizedNotes' in firstSet);
        } else {
            console.log('No sets found.');
        }
    } catch (e) {
        console.error('DB Test Failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
