import chalk from 'chalk'
import { createMathTasks } from './agents/math'

async function main() {
  console.log(chalk.cyan('\n🚀 Starting math operations\n'))

  try {
    // Initialize math tasks
    const mathTasks = await createMathTasks()

    // Input values
    const firstPair = [3, 4]
    const secondPair = [5, 6]

    console.log(chalk.cyan('📥 Input:'))
    console.log(chalk.gray(`   First pair: ${firstPair[0]} + ${firstPair[1]}`))
    console.log(chalk.gray(`   Second pair: ${secondPair[0]} + ${secondPair[1]}\n`))

    // Perform additions in parallel
    console.log(chalk.cyan('\n📊 Executing additions...'))
    const [firstSum, secondSum] = await Promise.all([
      mathTasks.add.run({ a: firstPair[0], b: firstPair[1] }),
      mathTasks.add.run({ a: secondPair[0], b: secondPair[1] }),
    ])
    console.log(chalk.gray(`   First addition: ${firstPair[0]} + ${firstPair[1]} = ${firstSum}`))
    console.log(chalk.gray(`   Second addition: ${secondPair[0]} + ${secondPair[1]} = ${secondSum}`))
    console.log(chalk.cyan('\n📊 Multiplying results...'))
    const finalProduct = Number(
      await mathTasks.multiply.run({
        a: firstSum,
        b: secondSum,
      }),
    )

    console.log(chalk.cyan('\n📊 Converting to words...'))
    const inWords = await mathTasks.toWords.run({
      number: finalProduct,
    })

    // Display results
    console.log(chalk.cyan('\n📊 Final Results:'))
    console.log(chalk.gray(`   First addition: ${firstPair[0]} + ${firstPair[1]} = ${firstSum}`))
    console.log(chalk.gray(`   Second addition: ${secondPair[0]} + ${secondPair[1]} = ${secondSum}`))
    console.log(chalk.gray(`   Final multiplication: ${firstSum} × ${secondSum} = ${finalProduct}`))
    console.log(chalk.gray(`   In words: ${inWords}\n`))
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error)
    process.exit(1)
  }
}

main()
