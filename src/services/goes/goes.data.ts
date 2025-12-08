/**
 * GOES Mock Database
 * 
 * Simulates the Ministry of Health GOES system
 * Contains single-use codes for patient exam validation
 */

export interface GOESCode {
    goesCode: string;
    examId: number;
    examName: string;
    patientName: string;
    patientSurname: string;
    document: string;
    used: boolean;
    expiryDate: string;
}

export const goesCodes: GOESCode[] = [
    {
        goesCode: "123456",
        examId: 1,
        examName: "Hemograma Completo",
        patientName: "Juan",
        patientSurname: "Pérez",
        document: "03791234-5",
        used: false,
        expiryDate: "2026-01-15"
    },
    {
        goesCode: "789012",
        examId: 7,
        examName: "Examen de Orina Completo",
        patientName: "María",
        patientSurname: "González",
        document: "04123456-7",
        used: false,
        expiryDate: "2026-02-01"
    },
    {
        goesCode: "345678",
        examId: 3,
        examName: "Glucosa en Sangre",
        patientName: "Carlos",
        patientSurname: "Martínez",
        document: "05234567-8",
        used: false,
        expiryDate: "2026-01-20"
    },
    {
        goesCode: "901234",
        examId: 12,
        examName: "Radiografía de Tórax",
        patientName: "Ana",
        patientSurname: "Rodríguez",
        document: "06345678-9",
        used: false,
        expiryDate: "2026-02-10"
    },
    {
        goesCode: "567890",
        examId: 5,
        examName: "Perfil Lipídico",
        patientName: "Luis",
        patientSurname: "Hernández",
        document: "07456789-0",
        used: false,
        expiryDate: "2026-01-25"
    },
    {
        goesCode: "234567",
        examId: 8,
        examName: "Prueba de Embarazo",
        patientName: "Carmen",
        patientSurname: "López",
        document: "08567890-1",
        used: false,
        expiryDate: "2026-01-30"
    },
    {
        goesCode: "890123",
        examId: 2,
        examName: "Creatinina",
        patientName: "Roberto",
        patientSurname: "García",
        document: "09678901-2",
        used: false,
        expiryDate: "2026-02-05"
    },
    {
        goesCode: "456789",
        examId: 15,
        examName: "Electrocardiograma",
        patientName: "Patricia",
        patientSurname: "Sánchez",
        document: "10789012-3",
        used: false,
        expiryDate: "2026-01-18"
    },
    {
        goesCode: "012345",
        examId: 9,
        examName: "Hepatitis B",
        patientName: "Fernando",
        patientSurname: "Ramírez",
        document: "11890123-4",
        used: false,
        expiryDate: "2026-02-15"
    },
    {
        goesCode: "678901",
        examId: 4,
        examName: "Ácido Úrico",
        patientName: "Elena",
        patientSurname: "Torres",
        document: "12901234-5",
        used: false,
        expiryDate: "2026-01-22"
    }
];
