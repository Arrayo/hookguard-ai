export class AnalyzeReactCodeUseCase {
    reviewer;
    constructor(reviewer) {
        this.reviewer = reviewer;
    }
    async execute(input) {
        return this.reviewer.analyzeReactCode(input.code);
    }
}
